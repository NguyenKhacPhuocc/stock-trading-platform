import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppGateway } from '../../websocket/app.gateway';
import {
  WS_TY,
  compactOrderbookDelta,
  compactTradeTick,
} from '../../websocket/market-ws-compact';
import { Stock } from '../../database/entities/stock.entity';
import { DEFAULT_STOCK_BOARD_ID } from '../../common/const';
import type { MarketDeltaEnvelope } from './dto/matching.dto';
import { SymbolBook, type PriceLevel } from './util/symbol-book';
import {
  BOOK_DEPTH_KEYS,
  type DepthSnapshot,
  aggregatePriceLevels,
  summarizeBookDepth,
} from './util/book-depth.util';
import { ORDERBOOK_CACHE_MAX_LEVELS } from './util/matching.constants';
import { BookRegistry } from './book-registry.service';
import { OrderbookWalService } from './orderbook-wal.service';
import { OrderbookRedisService } from './orderbook-redis.service';

type LevelChange = { p: number; v: number };

/** Push TOP sổ / delta qua WebSocket. */
@Injectable()
export class OrderbookWsService {
  private readonly logger = new Logger(OrderbookWsService.name);
  private seq = 1;
  private readonly prevBookDepth = new Map<string, DepthSnapshot>();
  private readonly prevBidDepth = new Map<string, Map<number, number>>();
  private readonly prevAskDepth = new Map<string, Map<number, number>>();
  private readonly exchangeCache = new Map<string, string | undefined>();

  constructor(
    @Inject(forwardRef(() => AppGateway))
    private readonly gateway: AppGateway,
    private readonly books: BookRegistry,
    private readonly wal: OrderbookWalService,
    private readonly orderbookRedis: OrderbookRedisService,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
  ) {}

  async publishSubscribeBySymbol(rawSymbol: string): Promise<void> {
    const sym = rawSymbol.trim().toUpperCase();
    const stock = await this.stockRepo.findOne({
      where: { symbol: sym, boardId: DEFAULT_STOCK_BOARD_ID },
    });
    if (!stock) return;

    const ex = await this.exchangeForStock(stock.id);
    const book = this.books.getBook(stock.id);
    let hasLiveBook = book.bidLevels.length > 0 || book.askLevels.length > 0;

    if (!hasLiveBook) {
      const recovered = await this.wal.replayIntoBook(sym, stock.id, book);
      if (recovered) {
        hasLiveBook = book.bidLevels.length > 0 || book.askLevels.length > 0;
        this.logger.log(`${sym}: book rebuilt from WAL, gửi OB_SNAPSHOT`);
      }
    }

    if (hasLiveBook) {
      this.emitSnapshotFromBook(sym, book, ex);
    } else {
      const snapshot = await this.orderbookRedis.readSnapshot(sym);
      this.logger.log(
        `${sym}: OB_SNAPSHOT từ Redis bids=${snapshot.bids.length} asks=${snapshot.asks.length}`,
      );
      this.initDiffState(sym, snapshot.bids, snapshot.asks);
      this.gateway.emitInstrumentTick(
        { ty: 'OB_SNAPSHOT', q: this.nextSeq(), SB: sym, ch: snapshot },
        ex,
      );
    }
  }

  async emitBookUpdate(
    symbol: string,
    book: SymbolBook,
    stockId: string,
  ): Promise<void> {
    const sym = symbol.toUpperCase();
    const ex = await this.exchangeForStock(stockId);

    await this.orderbookRedis.syncFromBook(sym, book);

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

    const { b, a } = this.diffFullDepth(sym, book.bidLevels, book.askLevels);
    if (b.length > 0 || a.length > 0) {
      this.gateway.emitInstrumentTick(
        { ty: 'BOOK_DELTA', q: this.nextSeq(), SB: sym, ch: { b, a } },
        ex,
      );
    }
  }

  emitTradeTick(
    symbol: string,
    stockId: string,
    price: number,
    qty: number,
  ): void {
    void this.exchangeForStock(stockId).then((ex) => {
      this.gateway.emitInstrumentTick(
        {
          ty: WS_TY.TRADE_TICK,
          q: this.nextSeq(),
          SB: symbol.toUpperCase(),
          ch: compactTradeTick(price, qty),
        } as MarketDeltaEnvelope,
        ex,
      );
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
