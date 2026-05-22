import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppGateway } from '../../websocket/app.gateway';
import {
  WS_TY,
  BOARD_DEPTH_PATCH_KEYS,
  BOARD_PATCH_KEYS,
  compactSnapshotBoardPatch,
  diffSnapshotBoardPatch,
  firstDepthOnlyDelta,
} from '../../websocket/market-ws-compact';
import { Stock } from '../../database/entities/stock.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { Order } from '../../database/entities/order.entity';
import { DEFAULT_STOCK_BOARD_ID, OrderStatus, OrderType } from '../../common/const';
import type { MarketDeltaEnvelope, QueuedOrder } from './dto/matching.dto';
import { SymbolBook, type PriceLevel } from './util/symbol-book';
import {
  aggregatePriceLevels,
  bookDepthTotals,
  summarizeBookDepth,
} from './util/book-depth.util';
import { ORDERBOOK_CACHE_MAX_LEVELS } from './util/matching.constants';
import { bookDepthLine, bookOrdersLine } from './util/order-flow-log.util';
import { BookRegistry } from './book-registry.service';
import { OrderbookWalService } from './orderbook-wal.service';
import { OrderbookRedisService } from './orderbook-redis.service';

type LevelChange = { p: number; v: number };

/** Push TOP sổ / delta qua WebSocket. */
@Injectable()
export class OrderbookWsService {
  private readonly logger = new Logger(OrderbookWsService.name);
  private seq = 1;
  private readonly prevBidDepth = new Map<string, Map<number, number>>();
  private readonly prevAskDepth = new Map<string, Map<number, number>>();
  private readonly exchangeCache = new Map<string, string | undefined>();
  /** Trạng thái bảng giá đã emit — chỉ push field thay đổi. */
  private readonly prevBoardPatchBySymbol = new Map<
    string,
    Record<string, unknown>
  >();

  constructor(
    @Inject(forwardRef(() => AppGateway))
    private readonly gateway: AppGateway,
    private readonly books: BookRegistry,
    private readonly wal: OrderbookWalService,
    private readonly orderbookRedis: OrderbookRedisService,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
  ) {}

  /**
   * Chuẩn bị sổ trước khớp: RAM → DB (pending/partial) → WAL replay nếu vẫn rỗng.
   */
  async ensureBookReady(
    sym: string,
    stockId: string,
    book: SymbolBook,
    excludeOrderId?: string,
  ): Promise<void> {
    if (book.bidLevels.length > 0 || book.askLevels.length > 0) {
      if (excludeOrderId) book.removeOrder(excludeOrderId);
      return;
    }

    const fromDb = await this.rebuildBookFromOpenOrders(
      stockId,
      book,
      excludeOrderId,
    );
    if (fromDb > 0) {
      this.logger.log(
        `[order-flow] ensureBook from DB | ${sym} loaded=${fromDb} ${bookOrdersLine(book)}`,
      );
      return;
    }

    const fromWal = await this.wal.replayIntoBook(sym, stockId, book);
    if (fromWal) {
      this.logger.log(
        `[order-flow] ensureBook from WAL | ${sym} ${bookOrdersLine(book)}`,
      );
    }
  }

  /** Sau khớp/hủy: RAM = đúng pending/partial trong DB (tránh bản trùng từ rest). */
  async syncBookFromDb(
    sym: string,
    stockId: string,
    book: SymbolBook,
  ): Promise<number> {
    const n = await this.rebuildBookFromOpenOrders(stockId, book);
    this.logger.log(
      `[order-flow] book synced from DB | ${sym} open=${n} ${bookOrdersLine(book)}`,
    );
    return n;
  }

  async publishSubscribeBySymbol(rawSymbol: string): Promise<void> {
    const sym = rawSymbol.trim().toUpperCase();
    const stock = await this.stockRepo.findOne({
      where: { symbol: sym, boardId: DEFAULT_STOCK_BOARD_ID },
    });
    if (!stock) return;

    const ex = await this.exchangeForStock(stock.id);
    const book = this.books.getBook(stock.id);

    const openCount = await this.rebuildBookFromOpenOrders(stock.id, book);
    await this.wal.persistBook(sym, stock.id, book);

    const isEmpty = book.bidLevels.length === 0 && book.askLevels.length === 0;
    if (isEmpty) {
      await this.orderbookRedis.clearSymbol(sym);
    } else {
      await this.orderbookRedis.syncFromBook(sym, book);
    }

    this.logger.log(
      `[order-flow] subscribe OB_SNAPSHOT from DB | ${sym} openOrders=${openCount} ${bookDepthLine(book.bidLevels.length, book.askLevels.length)}`,
    );
    this.emitSnapshotFromBook(sym, book, ex);
  }

  async emitBookUpdate(
    symbol: string,
    book: SymbolBook,
    stockId: string,
  ): Promise<void> {
    const sym = symbol.toUpperCase();
    const ex = await this.exchangeForStock(stockId);
    const isEmpty = book.bidLevels.length === 0 && book.askLevels.length === 0;

    if (isEmpty) {
      this.logger.log(`[order-flow] emit WS OB_SNAPSHOT empty | ${sym}`);
      this.emitSnapshotFromBook(sym, book, ex);
    } else {
      const { b, a } = this.diffFullDepth(sym, book.bidLevels, book.askLevels);
      if (b.length > 0 || a.length > 0) {
        this.logger.log(
          `[order-flow] emit WS BOOK_DELTA | ${sym} bidChg=${b.length} askChg=${a.length}`,
        );
        this.gateway.emitInstrumentTick(
          { ty: 'BOOK_DELTA', q: this.nextSeq(), SB: sym, ch: { b, a } },
          ex,
        );
      } else {
        this.logger.log(`[order-flow] emit WS OB_SNAPSHOT full | ${sym}`);
        this.emitSnapshotFromBook(sym, book, ex);
      }
    }

    void this.persistBookSideEffects(sym, stockId, book, isEmpty);
  }

  /** TOP3 + TB/TO từ sổ RAM — không query DB (hot path treo/hủy lệnh). */
  emitBoardDepthFromBook(
    symbol: string,
    stockId: string,
    book: SymbolBook,
  ): void {
    const sym = symbol.toUpperCase();
    const depth = summarizeBookDepth(book);
    const { totalBid, totalOffer } = bookDepthTotals(book);
    const next: Record<string, unknown> = {
      B3: depth.bid3Price ?? 0,
      V3: depth.bid3Volume ?? 0,
      B2: depth.bid2Price ?? 0,
      V2: depth.bid2Volume ?? 0,
      B1: depth.bid1Price ?? 0,
      V1: depth.bid1Volume ?? 0,
      S1: depth.ask1Price ?? 0,
      U1: depth.ask1Volume ?? 0,
      S2: depth.ask2Price ?? 0,
      U2: depth.ask2Volume ?? 0,
      S3: depth.ask3Price ?? 0,
      U3: depth.ask3Volume ?? 0,
      TB: totalBid,
      TO: totalOffer,
    };
    const hadPrev = this.prevBoardPatchBySymbol.has(sym);
    const prev = this.prevBoardPatchBySymbol.get(sym) ?? {};
    const ch =
      !hadPrev && (totalBid > 0 || totalOffer > 0)
        ? firstDepthOnlyDelta(next)
        : diffSnapshotBoardPatch(prev, next, BOARD_DEPTH_PATCH_KEYS);
    this.prevBoardPatchBySymbol.set(sym, { ...prev, ...next });
    if (Object.keys(ch).length === 0) return;

    void this.exchangeForStock(stockId).then((ex) => {
      const envelope = {
        ty: WS_TY.ORDERBOOK_DELTA,
        q: this.nextSeq(),
        SB: sym,
        ch,
      } as MarketDeltaEnvelope;
      this.logger.log(
        `[order-flow] emit WS BOARD_DELTA (RAM) | ${sym} keys=${Object.keys(ch).join(',')}`,
      );
      this.gateway.emitInstrumentTick(envelope, ex);
    });
  }

  private persistBookSideEffects(
    sym: string,
    stockId: string,
    book: SymbolBook,
    isEmpty: boolean,
  ): void {
    void (async () => {
      try {
        if (isEmpty) {
          this.logger.log(`[order-flow] Redis orderbook cache cleared | ${sym}`);
          await this.orderbookRedis.clearSymbol(sym);
        } else {
          await this.orderbookRedis.syncFromBook(sym, book);
          this.logger.log(`[order-flow] Redis orderbook cache synced | ${sym}`);
        }
        await this.wal.persistBook(sym, stockId, book);
      } catch (e: unknown) {
        this.logger.warn(`persistBookSideEffects ${sym}: ${String(e)}`);
      }
    })();
  }

  /**
   * Push bảng giá `ty=OB`.
   * @param depthOnly — treo/hủy lệnh: chỉ TOP3 + TB/TO; khớp: thêm CP/CH/TT/...
   */
  emitPriceBoardFromSnapshot(
    symbol: string,
    stockId: string,
    snap: StockBoardSnapshot,
    depthOnly: boolean,
  ): void {
    const sym = symbol.toUpperCase();
    const next = compactSnapshotBoardPatch(snap);
    const hadPrev = this.prevBoardPatchBySymbol.has(sym);
    const prev = this.prevBoardPatchBySymbol.get(sym) ?? {};
    const keys = depthOnly ? BOARD_DEPTH_PATCH_KEYS : BOARD_PATCH_KEYS;
    const ch =
      !hadPrev && depthOnly
        ? firstDepthOnlyDelta(next)
        : diffSnapshotBoardPatch(prev, next, keys);
    this.prevBoardPatchBySymbol.set(sym, { ...next });
    if (Object.keys(ch).length === 0) return;

    void this.exchangeForStock(stockId).then((ex) => {
      const envelope = {
        ty: WS_TY.ORDERBOOK_DELTA,
        q: this.nextSeq(),
        SB: sym,
        ch,
      } as MarketDeltaEnvelope;
      this.logger.log(
        `[order-flow] emit WS BOARD_DELTA | ${sym} keys=${Object.keys(ch).join(',')} payload=${JSON.stringify(ch)}`,
      );
      this.gateway.emitInstrumentTick(envelope, ex);
    });
  }

  private nextSeq(): number {
    return this.seq++;
  }

  private diffFullDepth(
    sym: string,
    bidLevels: readonly PriceLevel[],
    askLevels: readonly PriceLevel[],
  ): { b: LevelChange[]; a: LevelChange[] } {
    const prevBid = this.prevBidDepth.get(sym) ?? new Map<number, number>();
    const prevAsk = this.prevAskDepth.get(sym) ?? new Map<number, number>();

    const newBid = new Map<number, number>();
    for (const lvl of bidLevels) {
      if (lvl.totalQty > 0) newBid.set(lvl.price, lvl.totalQty);
    }
    const newAsk = new Map<number, number>();
    for (const lvl of askLevels) {
      if (lvl.totalQty > 0) newAsk.set(lvl.price, lvl.totalQty);
    }

    const b: LevelChange[] = [];
    for (const [price, vol] of newBid) {
      if (prevBid.get(price) !== vol) b.push({ p: price, v: vol });
    }
    for (const [price] of prevBid) {
      if (!newBid.has(price)) b.push({ p: price, v: 0 });
    }

    const a: LevelChange[] = [];
    for (const [price, vol] of newAsk) {
      if (prevAsk.get(price) !== vol) a.push({ p: price, v: vol });
    }
    for (const [price] of prevAsk) {
      if (!newAsk.has(price)) a.push({ p: price, v: 0 });
    }

    this.prevBidDepth.set(sym, newBid);
    this.prevAskDepth.set(sym, newAsk);

    return { b, a };
  }

  private async exchangeForStock(stockId: string): Promise<string | undefined> {
    if (this.exchangeCache.has(stockId)) {
      return this.exchangeCache.get(stockId);
    }
    const row = await this.stockRepo.findOne({ where: { id: stockId } });
    const ex = row?.exchange ? String(row.exchange) : undefined;
    this.exchangeCache.set(stockId, ex);
    return ex;
  }

  private emitSnapshotFromBook(
    sym: string,
    book: SymbolBook,
    ex: string | undefined,
  ): void {
    const bids = aggregatePriceLevels(
      book.bidLevels,
      ORDERBOOK_CACHE_MAX_LEVELS,
    ).map((r) => ({ price: r.price, amount: r.volume }));
    const asks = aggregatePriceLevels(
      book.askLevels,
      ORDERBOOK_CACHE_MAX_LEVELS,
    ).map((r) => ({ price: r.price, amount: r.volume }));
    this.initDiffState(sym, bids, asks);
    this.gateway.emitInstrumentTick(
      { ty: 'OB_SNAPSHOT', q: this.nextSeq(), SB: sym, ch: { bids, asks } },
      ex,
    );
  }

  /** Nguồn sự thật: chỉ lệnh pending/partial trong DB. */
  private async rebuildBookFromOpenOrders(
    stockId: string,
    book: SymbolBook,
    excludeOrderId?: string,
  ): Promise<number> {
    const rows = await this.orderRepo.find({
      where: {
        stockId,
        status: In([OrderStatus.PENDING, OrderStatus.PARTIAL]),
      },
      order: { createdAt: 'ASC' },
    });

    book.restore({ bids: [], asks: [] });
    let count = 0;
    for (const o of rows) {
      if (excludeOrderId && o.id === excludeOrderId) continue;
      if (o.orderType === OrderType.MAK) continue;
      const remaining = Number(o.quantity) - Number(o.matchedQty);
      if (remaining <= 0) continue;
      const queued: QueuedOrder = {
        orderId: o.id,
        tradingAccountId: o.tradingAccountId,
        stockId: o.stockId,
        side: o.side,
        price: Number(o.price ?? 0),
        remainingQty: remaining,
        createdAtMs: o.createdAt.getTime(),
      };
      book.rest(queued);
      count++;
    }
    return count;
  }

  private initDiffState(
    sym: string,
    bids: { price: number; amount: number }[],
    asks: { price: number; amount: number }[],
  ): void {
    const bidMap = new Map<number, number>();
    for (const r of bids) bidMap.set(r.price, r.amount);
    const askMap = new Map<number, number>();
    for (const r of asks) askMap.set(r.price, r.amount);
    this.prevBidDepth.set(sym, bidMap);
    this.prevAskDepth.set(sym, askMap);
  }
}
