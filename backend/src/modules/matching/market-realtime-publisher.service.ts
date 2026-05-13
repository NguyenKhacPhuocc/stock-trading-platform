import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppGateway } from '../../websocket/app.gateway';
import { Stock } from '../../database/entities/stock.entity';
import { DEFAULT_STOCK_BOARD_ID } from '../../common/const';
import { MarketService } from '../market/market.service';
import { MatchingRegistryService } from './matching-registry.service';
import type { PriceLevel, SymbolBook } from './symbol-book';
import {
  BOOK_DEPTH_KEYS,
  type DepthSnapshot,
  aggregatePriceLevels,
  summarizeBookDepth,
} from './book-depth.util';
import { OrderbookCacheService } from './orderbook-cache.service';
import { ORDERBOOK_CACHE_MAX_LEVELS } from './order-redis.constants';
import {
  WS_TY,
  compactOrderbookDelta,
  compactTradeTick,
} from '../../websocket/market-ws-compact';
import { MatchingEventBus } from './matching-event-bus.service';
import { OrderbookWalService } from './orderbook-wal.service';

export type MarketDeltaEnvelope = {
  ty: typeof WS_TY.ORDERBOOK_DELTA | typeof WS_TY.TRADE_TICK;
  q: number;
  SB: string;
  ch: Record<string, unknown>;
};

/** Mức giá delta compact cho BOOK_DELTA: p=price, v=volume (0=xóa mức). */
type LevelChange = { p: number; v: number };

@Injectable()
export class MarketRealtimePublisherService implements OnModuleInit {
  private readonly logger = new Logger(MarketRealtimePublisherService.name);
  private seq = 1;

  // Diff TOP3 cho ORDERBOOK_DELTA (bảng giá compact)
  private readonly prevBookDepth = new Map<string, DepthSnapshot>();

  // Diff full-depth cho BOOK_DELTA (sổ lệnh chi tiết)
  private readonly prevBidDepth = new Map<string, Map<number, number>>();
  private readonly prevAskDepth = new Map<string, Map<number, number>>();

  // Exchange metadata cache — không thay đổi trong phiên
  private readonly exchangeCache = new Map<string, string | undefined>();

  constructor(
    @Inject(forwardRef(() => AppGateway))
    private readonly gateway: AppGateway,
    private readonly market: MarketService,
    private readonly registry: MatchingRegistryService,
    private readonly orderbookCache: OrderbookCacheService,
    private readonly eventBus: MatchingEventBus,
    private readonly wal: OrderbookWalService,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
  ) {}

  onModuleInit(): void {
    this.eventBus.onBookUpdated(async (p) => {
      await this.market
        .refreshBoardForStock(p.stockId)
        .catch((e: unknown) =>
          this.logger.warn(`refreshBoardForStock: ${String(e)}`),
        );
      const ex = await this.exchangeUpperForStock(p.stockId);
      await this.emitBookUpdate(p.symbol, p.book, ex);

      if (p.fillsCount > 0 && p.lastTradePrice != null && p.lastMatchedQty > 0) {
        this.gateway.emitInstrumentTick(
          {
            ty: WS_TY.TRADE_TICK,
            q: this.nextSeq(),
            SB: p.symbol.toUpperCase(),
            ch: compactTradeTick(p.lastTradePrice, p.lastMatchedQty),
          } as MarketDeltaEnvelope,
          ex,
        );
      }
    });

    this.eventBus.onBookCancelled(async (p) => {
      await this.market
        .refreshBoardForStock(p.stockId)
        .catch((e: unknown) =>
          this.logger.warn(`refreshBoardForStock: ${String(e)}`),
        );
      const ex = await this.exchangeUpperForStock(p.stockId);
      await this.emitBookUpdate(p.symbol, p.book, ex);
    });
  }

  private nextSeq(): number {
    return this.seq++;
  }

  private depthNum(v: unknown): number | undefined {
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  }

  private diffBookDepth(
    sym: string,
    next: DepthSnapshot,
  ): Record<string, unknown> {
    const prev = this.prevBookDepth.get(sym) ?? {};
    const changes: Record<string, unknown> = {};
    for (const pk of BOOK_DEPTH_KEYS) {
      const a = this.depthNum(prev[pk]);
      const b = this.depthNum(next[pk]);
      if (a !== b) changes[pk] = b === undefined ? null : b;
    }
    this.prevBookDepth.set(sym, { ...next });
    return changes;
  }

  /**
   * Tính delta full-depth giữa trạng thái cũ và mới.
   * Chỉ trả về các mức có thay đổi; v=0 nghĩa là mức giá đó đã biến mất.
   */
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

  private async exchangeUpperForStock(
    stockId: string,
  ): Promise<string | undefined> {
    if (this.exchangeCache.has(stockId)) {
      return this.exchangeCache.get(stockId);
    }
    const row = await this.stockRepo.findOne({ where: { id: stockId } });
    const ex = row?.exchange ? String(row.exchange) : undefined;
    this.exchangeCache.set(stockId, ex);
    return ex;
  }

  /**
   * Sau `subscribe:i`:
   * 1. Book còn sống trong RAM → OB_SNAPSHOT từ RAM (server không restart).
   * 2. Book rỗng → thử WAL replay (rebuild book từ snapshot + WAL events).
   * 3. Không có WAL → fallback Redis hash cache (backward compat).
   */
  async publishSubscribeOrderbookBySymbol(rawSymbol: string): Promise<void> {
    const sym = rawSymbol.trim().toUpperCase();
    const stock = await this.stockRepo.findOne({
      where: { symbol: sym, boardId: DEFAULT_STOCK_BOARD_ID },
    });
    if (!stock) return;

    const ex = await this.exchangeUpperForStock(stock.id);
    const book = this.registry.getBook(stock.id);
    let hasLiveBook = book.bidLevels.length > 0 || book.askLevels.length > 0;

    // Thử WAL recovery nếu book rỗng (sau restart)
    if (!hasLiveBook) {
      const recovered = await this.wal.replayIntoBook(sym, stock.id, book);
      if (recovered) {
        hasLiveBook = book.bidLevels.length > 0 || book.askLevels.length > 0;
        this.logger.log(`[WAL recovery] ${sym}: book rebuilt, sending OB_SNAPSHOT from RAM`);
      }
    }

    if (hasLiveBook) {
      this.emitSnapshotFromBook(sym, book, ex);
    } else {
      // Fallback: Redis hash cache (ghi bởi orderbookCache khi book còn sống)
      const snapshot = await this.orderbookCache.getOrderbookSnapshot(sym);
      this.logger.log(
        `[OB_SNAPSHOT Redis] ${sym}: bids=${snapshot.bids.length}, asks=${snapshot.asks.length}`,
      );
      this.initDiffState(sym, snapshot.bids, snapshot.asks);
      this.gateway.emitInstrumentTick(
        { ty: 'OB_SNAPSHOT', q: this.nextSeq(), SB: sym, ch: snapshot },
        ex,
      );
    }
  }

  private emitSnapshotFromBook(
    sym: string,
    book: SymbolBook,
    ex: string | undefined,
  ): void {
    const bids = aggregatePriceLevels(book.bidLevels, ORDERBOOK_CACHE_MAX_LEVELS).map(
      (r) => ({ price: r.price, amount: r.volume }),
    );
    const asks = aggregatePriceLevels(book.askLevels, ORDERBOOK_CACHE_MAX_LEVELS).map(
      (r) => ({ price: r.price, amount: r.volume }),
    );
    this.initDiffState(sym, bids, asks);
    this.gateway.emitInstrumentTick(
      { ty: 'OB_SNAPSHOT', q: this.nextSeq(), SB: sym, ch: { bids, asks } },
      ex,
    );
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

  /**
   * Cập nhật Redis cache + emit:
   * - ORDERBOOK_DELTA (TOP3 compact) → bảng giá
   * - BOOK_DELTA (full-depth diff)   → sổ lệnh chi tiết
   *
   * Không đọc lại Redis sau khi write — tính từ in-memory book.
   */
  private async emitBookUpdate(
    symbol: string,
    book: SymbolBook,
    ex: string | undefined,
  ): Promise<void> {
    const sym = symbol.toUpperCase();

    await this.orderbookCache.setMergedLevelsFromBook(sym, book);

    // ORDERBOOK_DELTA TOP3 cho price board
    const depth = summarizeBookDepth(book);
    const obChanges = this.diffBookDepth(sym, depth);
    if (Object.keys(obChanges).length > 0) {
      this.gateway.emitInstrumentTick(
        {
          ty: WS_TY.ORDERBOOK_DELTA,
          q: this.nextSeq(),
          SB: sym,
          ch: compactOrderbookDelta(obChanges),
        } as MarketDeltaEnvelope,
        ex,
      );
    }

    // BOOK_DELTA full-depth cho sổ lệnh chi tiết — chỉ gửi mức thay đổi
    const { b, a } = this.diffFullDepth(sym, book.bidLevels, book.askLevels);
    if (b.length > 0 || a.length > 0) {
      this.gateway.emitInstrumentTick(
        { ty: 'BOOK_DELTA', q: this.nextSeq(), SB: sym, ch: { b, a } },
        ex,
      );
    }
  }
}
