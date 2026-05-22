import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { MarketSnapshotIngest } from '../../database/entities/market-snapshot-ingest.entity';
import {
  Exchange,
  OrderSide,
  OrderStatus,
  CacheKey,
  CacheTtl,
  marketSymbolsCacheKey,
  DEFAULT_STOCK_BOARD_ID,
  MarketSnapshotIngestStatus,
  MarketSnapshotSource,
} from '../../common/const';
import { RedisService } from '../../redis/redis.service';
import { toNum } from './util/market-price.util';
import type {
  MarketInstrumentDto,
  MarketSnapshotIngestResultDto,
} from './dto/market-instrument.dto';

interface DepthLevel {
  price: number;
  vol: number;
}

type SsiExchangePath = 'hose' | 'hnx' | 'upcom';

interface SsiSymbol {
  boardId?: string;
  companyNameVi?: string;
  exchange?: string;
  stockSymbol?: string;
  refPrice?: number | string;
  ceiling?: number | string;
  floor?: number | string;
  tradingDate?: string;
  tradingUnit?: number | string;
}

interface SsiResponseLike {
  data?: unknown;
  items?: unknown;
}

/** Một dòng cache Redis — snapshot `stock_board_snapshots` + các cột `stocks` cần cho UI/API */
export interface CachedSymbolRow {
  snapshotId: string | null;
  stockId: string;
  symbol: string;
  exchange: Exchange;
  fullName: string;
  nameEn: string | null;
  isin: string | null;
  lotSize: number;
  tickSize: number;
  ceilPct: number;
  floorPct: number;
  tradingDate: string;
  referencePrice: number;
  ceilingPrice: number;
  floorPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  lastPrice: number;
  lastVolume: number;
  totalVolume: number;
  totalValue: number;
  bidPrice1: number;
  bidPrice2: number;
  bidPrice3: number;
  bidVol1: number;
  bidVol2: number;
  bidVol3: number;
  offerPrice1: number;
  offerPrice2: number;
  offerPrice3: number;
  offerVol1: number;
  offerVol2: number;
  offerVol3: number;
  totalBidQty: number;
  totalOfferQty: number;
  priceChange: number;
  priceChangePct: number;
}

@Injectable()
export class MarketService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    @InjectRepository(PriceHistory) private priceRepo: Repository<PriceHistory>,
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Trade) private tradeRepo: Repository<Trade>,
    @InjectRepository(StockBoardSnapshot)
    private snapshotRepo: Repository<StockBoardSnapshot>,
    @InjectRepository(MarketSnapshotIngest)
    private ingestRepo: Repository<MarketSnapshotIngest>,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // SSI ingest: admin gọi forceRefreshMarketSnapshot()
  }

  /** Admin sync snapshot từ SSI → stocks + stock_board_snapshots */
  forceRefreshMarketSnapshot(): Promise<MarketSnapshotIngestResultDto> {
    return this.runSsiIngest();
  }

  /**
   * GET /market/quotes — master data: symbol, trần/sàn/TC theo ngày, thông tin mã.
   * Gọi trước khi render bảng giá; không chứa depth hay phiên realtime.
   */
  async getQuotes(symbols?: string): Promise<object[]> {
    const symbolFilter =
      symbols && symbols.toUpperCase() !== 'ALL'
        ? symbols
            .toUpperCase()
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
    const tradingDate = await this.resolveActiveTradingDate();
    const cachedRows = await this.getOrBuildSymbolsCacheRows(
      tradingDate,
      'ALL',
    );
    const filteredRows = symbolFilter
      ? cachedRows.filter((row) => symbolFilter.includes(row.symbol))
      : cachedRows;

    return filteredRows.map((row) => ({
      stockId: row.stockId,
      symbol: row.symbol,
      exchange: row.exchange,
      fullName: row.fullName,
      reference: row.referencePrice,
      ceiling: row.ceilingPrice,
      floor: row.floorPrice,
      tradeLot: row.lotSize,
      priceStep: row.tickSize,
      tradingDate: this.ymdToVN(row.tradingDate),
    }));
  }

  async getPrices(): Promise<PriceHistory[]> {
    const cached = await this.redis.get(CacheKey.MARKET_PRICES);
    if (cached) {
      const parsed = JSON.parse(cached) as PriceHistory[];
      return parsed;
    }

    const today = new Date().toISOString().split('T')[0];
    const prices = await this.priceRepo.find({
      where: { date: MoreThanOrEqual(today) as unknown as string },
      relations: { stock: true },
      order: { stock: { symbol: 'ASC' } },
    });

    await this.redis.set(
      CacheKey.MARKET_PRICES,
      JSON.stringify(prices),
      CacheTtl.MARKET_PRICES,
    );
    return prices;
  }

  /**
   * Đọc snapshot bảng giá đã lưu (`stock_board_snapshots`).
   * Đảm bảo có dòng cho ngày hiện tại (seed TC/trần/sàn nếu thiếu).
   * Không rebuild từ orders/trades tại đây — tránh ghi đè dữ liệu mỗi request;
   * board mô phỏng được cập nhật qua `refreshBoardForStock` sau đặt lệnh/khớp.
   * @param exchange — lọc sàn: HOSE | HNX | UPCOM; bỏ trống = tất cả.
   */
  async getInstruments(exchange?: string): Promise<MarketInstrumentDto[]> {
    const now = new Date();
    const tradingDate = await this.resolveActiveTradingDate(now);
    const ex = exchange?.trim().toUpperCase();
    if (ex && !Object.values(Exchange).includes(ex as Exchange)) {
      throw new BadRequestException(
        `exchange không hợp lệ: ${exchange}. Cho phép: ${Object.values(Exchange).join(', ')}`,
      );
    }
    const exchangeScope = ex ?? 'ALL';
    const cachedRows = await this.getOrBuildSymbolsCacheRows(
      tradingDate,
      exchangeScope,
    );
    const ts = now.getTime();
    return cachedRows.map((row) => this.cachedRowToInstrumentDto(row, ts));
  }

  /** Gọi sau đặt/hủy lệnh (và sau khớp) — UPDATE dòng snapshot theo stock_id (admin đã seed). */
  async refreshBoardForStock(
    stockId: string,
    options?: { rebuildSymbolsCache?: boolean },
  ): Promise<{
    symbol: string;
    stockId: string;
    snap: StockBoardSnapshot;
  } | null> {
    const stock = await this.stockRepo.findOne({ where: { id: stockId } });
    if (!stock) return null;

    const snap = await this.findSnapshotByStockId(stockId);
    if (!snap) {
      this.logger.warn(
        `[order-flow] stock_board_snapshots skip | ${stock.symbol} stockId=${stockId} chưa có dòng (cần admin refresh SSI)`,
      );
      return null;
    }

    const orders = await this.orderRepo.find({
      where: {
        stockId,
        status: In([OrderStatus.PENDING, OrderStatus.PARTIAL]),
      },
    });
    const trades = await this.tradeRepo
      .createQueryBuilder('trade')
      .innerJoin('trade.buyOrder', 'buyOrder')
      .where('buyOrder.stockId = :stockId', { stockId })
      .orderBy('trade.createdAt', 'ASC')
      .getMany();
    this.fillSnapshotFromOrdersAndTrades(snap, orders, trades);
    await this.snapshotRepo.save(snap);
    if (options?.rebuildSymbolsCache !== false) {
      await this.syncSymbolsCachesAfterSnapshotSave(snap.tradingDate);
    }
    this.logger.log(
      `[order-flow] DB save | table=stock_board_snapshots UPDATE id=${snap.id} ${stock.symbol} stockId=${stockId} lastPrice=${toNum(snap.lastPrice)} lastVolume=${snap.lastVolume} priceChange=${toNum(snap.priceChange ?? 0)} priceChangePct=${toNum(snap.priceChangePct ?? 0).toFixed(4)} trades=${trades.length}`,
    );
    return { symbol: stock.symbol, stockId: stock.id, snap };
  }

  /** Một mã = một dòng snapshot đang dùng (mới nhất theo trading_date từ admin). */
  private findSnapshotByStockId(
    stockId: string,
  ): Promise<StockBoardSnapshot | null> {
    return this.snapshotRepo.findOne({
      where: { stockId },
      order: { tradingDate: 'DESC' },
    });
  }

  async getPriceHistory(symbol: string, limit = 100) {
    return this.priceRepo.find({
      where: {
        stock: {
          symbol: symbol.toUpperCase(),
          boardId: DEFAULT_STOCK_BOARD_ID,
        },
      },
      relations: { stock: true },
      order: { date: 'DESC' },
      take: limit,
    });
  }

  private tradingDateYmd(d = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Chuẩn hóa date nhiều định dạng về dd/MM/yyyy để tránh crash khi cache cũ khác kiểu. */
  private ymdToVN(ymd: unknown): string {
    if (typeof ymd === 'string') {
      const normalized = ymd.includes('T') ? ymd.split('T')[0] : ymd;
      const [y, m, d] = normalized.split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return ymd;
    }

    if (ymd instanceof Date && Number.isFinite(ymd.getTime())) {
      const y = ymd.getFullYear();
      const m = String(ymd.getMonth() + 1).padStart(2, '0');
      const d = String(ymd.getDate()).padStart(2, '0');
      return `${d}/${m}/${y}`;
    }

    return '';
  }

  private async resolveActiveTradingDate(now = new Date()): Promise<string> {
    const today = this.tradingDateYmd(now);
    const raw = await this.snapshotRepo
      .createQueryBuilder('snapshot')
      .select('MAX(snapshot.tradingDate)', 'maxTradingDate')
      .getRawOne<{ maxTradingDate: string | null }>();

    const max = raw?.maxTradingDate;
    if (!max) return today;
    return max >= today ? today : max;
  }

  private async getOrBuildSymbolsCacheRows(
    tradingDate: string,
    scope: string,
  ): Promise<CachedSymbolRow[]> {
    const cacheKey = marketSymbolsCacheKey(tradingDate, scope);
    const lockKey = `${cacheKey}:lock`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as CachedSymbolRow[];

    const lockValue = await this.redis.get(lockKey);
    const lockAcquired = !lockValue;
    if (lockAcquired) {
      try {
        await this.redis.set(lockKey, '1', 5);
        const rows = await this.buildSymbolsCacheRows(tradingDate, scope);
        await this.redis.set(
          cacheKey,
          JSON.stringify(rows),
          CacheTtl.MARKET_SYMBOLS,
        );
        return rows;
      } finally {
        await this.redis.del(lockKey);
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await this.sleep(80);
      const retryCached = await this.redis.get(cacheKey);
      if (retryCached) return JSON.parse(retryCached) as CachedSymbolRow[];
    }

    const rows = await this.buildSymbolsCacheRows(tradingDate, scope);
    await this.redis.set(
      cacheKey,
      JSON.stringify(rows),
      CacheTtl.MARKET_SYMBOLS,
    );
    return rows;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async buildSymbolsCacheRows(
    tradingDate: string,
    scope: string,
  ): Promise<CachedSymbolRow[]> {
    const where =
      scope !== 'ALL'
        ? {
            isActive: true,
            boardId: DEFAULT_STOCK_BOARD_ID,
            exchange: scope as Exchange,
          }
        : { isActive: true, boardId: DEFAULT_STOCK_BOARD_ID };
    const stocks = await this.stockRepo.find({
      where,
      order: { symbol: 'ASC' },
    });
    if (stocks.length === 0) return [];

    const stockIds = stocks.map((s) => s.id);
    const snaps = await this.snapshotRepo
      .createQueryBuilder('snap')
      .distinctOn(['snap.stockId'])
      .where('snap.stockId IN (:...stockIds)', { stockIds })
      .orderBy('snap.stockId', 'ASC')
      .addOrderBy('snap.tradingDate', 'DESC')
      .getMany();
    const snapByStockId = new Map(snaps.map((s) => [s.stockId, s]));

    return stocks.map((stock) => {
      const snap = snapByStockId.get(stock.id);
      return {
        snapshotId: snap?.id ?? null,
        stockId: stock.id,
        symbol: stock.symbol,
        exchange: stock.exchange,
        fullName: stock.name,
        nameEn: stock.nameEn,
        isin: stock.isin,
        lotSize: stock.lotSize,
        tickSize: toNum(stock.tickSize),
        ceilPct: toNum(stock.ceilPct),
        floorPct: toNum(stock.floorPct),
        tradingDate: snap?.tradingDate ?? tradingDate,
        referencePrice: toNum(snap?.referencePrice ?? 0),
        ceilingPrice: toNum(snap?.ceilingPrice ?? 0),
        floorPrice: toNum(snap?.floorPrice ?? 0),
        openPrice: toNum(snap?.openPrice ?? 0),
        highPrice: toNum(snap?.highPrice ?? 0),
        lowPrice: toNum(snap?.lowPrice ?? 0),
        lastPrice: toNum(snap?.lastPrice ?? 0),
        lastVolume: snap?.lastVolume ?? 0,
        totalVolume: snap?.totalVolume ?? 0,
        totalValue: toNum(snap?.totalValue ?? 0),
        bidPrice1: toNum(snap?.bidPrice1 ?? 0),
        bidPrice2: toNum(snap?.bidPrice2 ?? 0),
        bidPrice3: toNum(snap?.bidPrice3 ?? 0),
        bidVol1: snap?.bidVol1 ?? 0,
        bidVol2: snap?.bidVol2 ?? 0,
        bidVol3: snap?.bidVol3 ?? 0,
        offerPrice1: toNum(snap?.offerPrice1 ?? 0),
        offerPrice2: toNum(snap?.offerPrice2 ?? 0),
        offerPrice3: toNum(snap?.offerPrice3 ?? 0),
        offerVol1: snap?.offerVol1 ?? 0,
        offerVol2: snap?.offerVol2 ?? 0,
        offerVol3: snap?.offerVol3 ?? 0,
        totalBidQty: snap?.totalBidQty ?? 0,
        totalOfferQty: snap?.totalOfferQty ?? 0,
        priceChange: toNum(snap?.priceChange ?? 0),
        priceChangePct: toNum(snap?.priceChangePct ?? 0),
      };
    });
  }

  /** Ghi Redis `market:symbols:<tradingDate>:<scope>` đồng bộ với DB (ALL + từng sàn). */
  async populateSymbolsCachesForTradingDate(
    tradingDate: string,
  ): Promise<void> {
    const scopes: Array<'ALL' | Exchange> = [
      'ALL',
      Exchange.HOSE,
      Exchange.HNX,
      Exchange.UPCOM,
    ];
    await Promise.all(
      scopes.map(async (scope) => {
        const rows = await this.buildSymbolsCacheRows(tradingDate, scope);
        await this.redis.set(
          marketSymbolsCacheKey(tradingDate, scope),
          JSON.stringify(rows),
          CacheTtl.MARKET_SYMBOLS,
        );
      }),
    );
  }

  private cachedRowToInstrumentDto(
    row: CachedSymbolRow,
    ts: number,
  ): MarketInstrumentDto {
    const totalVol = row.totalVolume;
    const totalVal = row.totalValue;
    const avgPrice = totalVol > 0 ? totalVal / totalVol : 0;
    return {
      symbol: row.symbol,
      stockId: row.stockId,
      fullName: row.fullName,
      tradingDate: this.ymdToVN(row.tradingDate),
      exchange: row.exchange,
      ceiling: row.ceilingPrice,
      floor: row.floorPrice,
      reference: row.referencePrice,
      bidPrice3: row.bidPrice3,
      bidVol3: row.bidVol3,
      bidPrice2: row.bidPrice2,
      bidVol2: row.bidVol2,
      bidPrice1: row.bidPrice1,
      bidVol1: row.bidVol1,
      offerPrice1: row.offerPrice1,
      offerVol1: row.offerVol1,
      offerPrice2: row.offerPrice2,
      offerVol2: row.offerVol2,
      offerPrice3: row.offerPrice3,
      offerVol3: row.offerVol3,
      closePrice: row.lastPrice,
      closeVol: row.lastVolume,
      priceChange: Math.round(row.priceChange * 100) / 100,
      priceChangePercent: Math.round(row.priceChangePct * 100) / 100,
      totalTrading: totalVol,
      totalTradingValue: totalVal,
      averagePrice: Math.round(avgPrice * 100) / 100,
      open: row.openPrice,
      high: row.highPrice,
      low: row.lowPrice,
      foreignBuy: 0,
      foreignSell: 0,
      foreignRemain: 0,
      foreignRoom: 0,
      TOTAL_OFFER_QTTY: row.totalOfferQty,
      TOTAL_BID_QTTY: row.totalBidQty,
      tradingSessionId: 'MOCK_CONTINUOUS',
      ts,
      kid: `${ts}-${randomBytes(8).toString('hex')}`,
    };
  }

  private applyPriceChangeFromReference(
    snap: StockBoardSnapshot,
    lastPrice: number,
  ): void {
    const refPx = toNum(snap.referencePrice);
    const lastPx = toNum(lastPrice);
    if (refPx <= 0 || lastPx <= 0) {
      snap.priceChange = 0;
      snap.priceChangePct = 0;
      return;
    }
    const priceChange = lastPx - refPx;
    snap.priceChange = Math.round(priceChange * 100) / 100;
    snap.priceChangePct = Math.round((priceChange / refPx) * 10000) / 10000;
  }

  private fillSnapshotFromOrdersAndTrades(
    snap: StockBoardSnapshot,
    orders: Order[],
    tradesAsc: Trade[],
  ): void {
    const depth = this.computeDepth(orders);

    if (tradesAsc.length > 0) {
      const session = this.aggregateSession(tradesAsc);
      snap.openPrice = session.open;
      snap.highPrice = session.high;
      snap.lowPrice = session.low;
      snap.lastPrice = session.lastPrice;
      snap.lastVolume = session.lastVol;
      snap.totalVolume = session.totalVol;
      snap.totalValue = session.totalVal;

      this.applyPriceChangeFromReference(snap, session.lastPrice);
    }

    snap.bidPrice1 = depth.bid[0].price;
    snap.bidPrice2 = depth.bid[1].price;
    snap.bidPrice3 = depth.bid[2].price;
    snap.bidVol1 = depth.bid[0].vol;
    snap.bidVol2 = depth.bid[1].vol;
    snap.bidVol3 = depth.bid[2].vol;
    snap.offerPrice1 = depth.ask[0].price;
    snap.offerPrice2 = depth.ask[1].price;
    snap.offerPrice3 = depth.ask[2].price;
    snap.offerVol1 = depth.ask[0].vol;
    snap.offerVol2 = depth.ask[1].vol;
    snap.offerVol3 = depth.ask[2].vol;
    snap.totalBidQty = depth.totalBid;
    snap.totalOfferQty = depth.totalOffer;
  }

  private aggregateSession(tradesAsc: Trade[]): {
    lastPrice: number;
    lastVol: number;
    totalVol: number;
    totalVal: number;
    avgPrice: number;
    open: number;
    high: number;
    low: number;
  } {
    if (tradesAsc.length === 0) {
      return {
        lastPrice: 0,
        lastVol: 0,
        totalVol: 0,
        totalVal: 0,
        avgPrice: 0,
        open: 0,
        high: 0,
        low: 0,
      };
    }
    let totalVol = 0;
    let totalVal = 0;
    let high = -Infinity;
    let low = Infinity;
    for (const t of tradesAsc) {
      const p = toNum(t.price);
      const q = toNum(t.quantity);
      const v = toNum(t.tradeValue);
      totalVol += q;
      totalVal += v;
      high = Math.max(high, p);
      low = Math.min(low, p);
    }
    const last = tradesAsc[tradesAsc.length - 1];
    const open = toNum(tradesAsc[0].price);
    return {
      lastPrice: toNum(last.price),
      lastVol: toNum(last.quantity),
      totalVol,
      totalVal,
      avgPrice: totalVol > 0 ? totalVal / totalVol : 0,
      open,
      high: high === -Infinity ? 0 : high,
      low: low === Infinity ? 0 : low,
    };
  }

  private computeDepth(orders: Order[]): {
    bid: DepthLevel[];
    ask: DepthLevel[];
    totalBid: number;
    totalOffer: number;
  } {
    const bidMap = new Map<number, number>();
    const askMap = new Map<number, number>();
    let totalBid = 0;
    let totalOffer = 0;

    for (const o of orders) {
      if (o.price == null) continue;
      const price = toNum(o.price);
      if (price <= 0) continue;
      const rem = toNum(o.quantity) - toNum(o.matchedQty);
      if (rem <= 0) continue;

      if (o.side === OrderSide.BUY) {
        bidMap.set(price, (bidMap.get(price) ?? 0) + rem);
        totalBid += rem;
      } else if (o.side === OrderSide.SELL) {
        askMap.set(price, (askMap.get(price) ?? 0) + rem);
        totalOffer += rem;
      }
    }

    const bidSorted = [...bidMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 3)
      .map(([price, vol]) => ({ price, vol }));
    const askSorted = [...askMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(0, 3)
      .map(([price, vol]) => ({ price, vol }));

    const pad3 = (arr: DepthLevel[]): DepthLevel[] => {
      const out = [...arr];
      while (out.length < 3) out.push({ price: 0, vol: 0 });
      return out;
    };

    return {
      bid: pad3(bidSorted),
      ask: pad3(askSorted),
      totalBid,
      totalOffer,
    };
  }

  private marketSymbolsCacheScopes(): Array<'ALL' | Exchange> {
    return ['ALL', Exchange.HOSE, Exchange.HNX, Exchange.UPCOM];
  }

  private async invalidateSymbolsCachesForTradingDate(
    tradingDate: string,
  ): Promise<void> {
    await Promise.all(
      this.marketSymbolsCacheScopes().map((scope) =>
        this.redis.del(marketSymbolsCacheKey(tradingDate, scope)),
      ),
    );
  }

  /** Sau khi ghi snapshot: xóa cache cũ + build lại từ DB (API không đọc dữ liệu lệch). */
  private async syncSymbolsCachesAfterSnapshotSave(
    snapshotTradingDate: string,
  ): Promise<void> {
    const activeDate = await this.resolveActiveTradingDate();
    const dates = new Set([activeDate, snapshotTradingDate]);
    for (const d of dates) {
      await this.invalidateSymbolsCachesForTradingDate(d);
    }
    await this.populateSymbolsCachesForTradingDate(activeDate);
    if (snapshotTradingDate !== activeDate) {
      await this.populateSymbolsCachesForTradingDate(snapshotTradingDate);
    }
    this.logger.log(
      `[order-flow] Redis market:symbols cache rebuilt | dates=${[...dates].join(',')}`,
    );
  }

  // ─── SSI snapshot ingest (admin) ─────────────────────────────────────────

  private async runSsiIngest(): Promise<MarketSnapshotIngestResultDto> {
    const fallbackTradingDate = this.tradingDateYmdVN();
    let ingestId: string | null = null;
    let mappedTradingDate = fallbackTradingDate;
    try {
      const rows = await this.fetchSsiAllExchanges();
      if (rows.length === 0) {
        throw new Error('SSI trả về danh sách rỗng cho tất cả sàn.');
      }

      mappedTradingDate = this.resolveSsiTradingDate(rows, fallbackTradingDate);

      const ingest = await this.ingestRepo.save(
        this.ingestRepo.create({
          tradingDate: mappedTradingDate,
          source: MarketSnapshotSource.SSI,
          status: MarketSnapshotIngestStatus.PENDING,
          startedAt: new Date(),
          finishedAt: null,
          errorMessage: null,
          symbolsUpserted: null,
        }),
      );
      ingestId = ingest.id;

      const symbolsUpserted = await this.upsertSsiDailySeed(
        rows,
        mappedTradingDate,
      );
      await this.refreshSymbolsCacheAfterIngest(mappedTradingDate);

      await this.ingestRepo.update(ingest.id, {
        status: MarketSnapshotIngestStatus.SUCCESS,
        finishedAt: new Date(),
        symbolsUpserted,
        errorMessage: null,
      });
      const message = `SSI ingest SUCCESS ${mappedTradingDate}: ${symbolsUpserted} mã.`;
      this.logger.log(message);
      return { tradingDate: mappedTradingDate, symbolsUpserted, message };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (ingestId) {
        await this.ingestRepo.update(ingestId, {
          status: MarketSnapshotIngestStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message,
        });
      } else {
        await this.ingestRepo.save(
          this.ingestRepo.create({
            tradingDate: mappedTradingDate,
            source: MarketSnapshotSource.SSI,
            status: MarketSnapshotIngestStatus.FAILED,
            startedAt: new Date(),
            finishedAt: new Date(),
            errorMessage: message,
            symbolsUpserted: 0,
          }),
        );
      }
      this.logger.error(`SSI ingest FAILED (${mappedTradingDate}): ${message}`);
      return {
        tradingDate: mappedTradingDate,
        symbolsUpserted: 0,
        message,
      };
    }
  }

  private async fetchSsiAllExchanges(): Promise<SsiSymbol[]> {
    const boardId = this.config.get<string>(
      'SSI_SNAPSHOT_BOARD_ID',
      DEFAULT_STOCK_BOARD_ID,
    );
    const baseUrl = this.config.get<string>(
      'SSI_SNAPSHOT_BASE_URL',
      'https://iboard-query.ssi.com.vn/stock/exchange',
    );
    const timeoutMs = Number(
      this.config.get<string>('SSI_SNAPSHOT_TIMEOUT_MS', '15000'),
    );
    const exchanges: readonly SsiExchangePath[] = ['hose', 'hnx', 'upcom'];
    const headers = this.ssiSnapshotHeaders();

    const all = await Promise.all(
      exchanges.map(async (exchange) => {
        const url = `${baseUrl}/${exchange}?boardId=${encodeURIComponent(boardId)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const resp = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });
          if (!resp.ok) {
            throw new Error(`SSI ${exchange} HTTP ${resp.status}`);
          }
          const json: unknown = await resp.json();
          return this.extractSsiRows(json);
        } finally {
          clearTimeout(timer);
        }
      }),
    );
    return all.flat();
  }

  private ssiSnapshotHeaders(): Record<string, string> {
    return {
      Origin: this.config.get<string>(
        'SSI_SNAPSHOT_ORIGIN',
        'https://iboard.ssi.com.vn',
      ),
      Referer: this.config.get<string>(
        'SSI_SNAPSHOT_REFERER',
        'https://iboard.ssi.com.vn/',
      ),
      'User-Agent': this.config.get<string>(
        'SSI_SNAPSHOT_USER_AGENT',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ),
      Accept: 'application/json',
    };
  }

  private extractSsiRows(payload: unknown): SsiSymbol[] {
    if (Array.isArray(payload)) return payload as SsiSymbol[];
    if (!payload || typeof payload !== 'object') return [];
    const candidate = payload as SsiResponseLike;
    if (Array.isArray(candidate.data)) return candidate.data as SsiSymbol[];
    if (Array.isArray(candidate.items)) return candidate.items as SsiSymbol[];
    return [];
  }

  private resolveSsiTradingDate(
    rows: SsiSymbol[],
    fallbackYmd: string,
  ): string {
    const fromApi = rows.find(
      (r) => typeof r.tradingDate === 'string',
    )?.tradingDate;
    if (!fromApi) return fallbackYmd;
    const raw = fromApi.trim();
    if (/^\d{8}$/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return fallbackYmd;
  }

  private async upsertSsiDailySeed(
    rows: SsiSymbol[],
    tradingDate: string,
  ): Promise<number> {
    const stockRows = rows
      .map((row) => this.toSsiStockSeed(row))
      .filter((row): row is QueryDeepPartialEntity<Stock> => row !== null);

    if (stockRows.length === 0) return 0;

    await this.stockRepo.upsert(stockRows, {
      conflictPaths: ['symbol', 'boardId'],
      skipUpdateIfNoValuesChanged: true,
    });

    const identityByKey = new Map<
      string,
      { symbol: string; boardId: string }
    >();
    for (const row of rows) {
      const symbol = (row.stockSymbol ?? '').trim().toUpperCase();
      if (!symbol) continue;
      const boardId = this.resolveSsiBoardId(row.boardId);
      identityByKey.set(`${symbol}|${boardId}`, { symbol, boardId });
    }
    const identities = [...identityByKey.values()];
    const stocks = await this.stockRepo.find({ where: identities });
    const stockIdByKey = new Map(
      stocks.map((s) => [`${s.symbol}|${s.boardId}`, s.id]),
    );

    const snapshots = rows
      .map((row) => this.toSsiSnapshotSeed(row, tradingDate, stockIdByKey))
      .filter(
        (row): row is QueryDeepPartialEntity<StockBoardSnapshot> =>
          row !== null,
      );

    if (snapshots.length > 0) {
      const activeStockIds = [
        ...new Set(
          snapshots
            .map((item) => item.stockId)
            .filter(
              (stockId): stockId is string => typeof stockId === 'string',
            ),
        ),
      ];
      await this.deleteSnapshotsOutsideTradingDate(tradingDate);
      await this.deleteStaleSnapshotsForTradingDate(
        activeStockIds,
        tradingDate,
      );
      await this.snapshotRepo.upsert(snapshots, {
        conflictPaths: ['stockId', 'tradingDate'],
        skipUpdateIfNoValuesChanged: true,
      });
    }

    return stockRows.length;
  }

  private toSsiStockSeed(row: SsiSymbol): QueryDeepPartialEntity<Stock> | null {
    const symbol = (row.stockSymbol ?? '').trim().toUpperCase();
    if (!symbol) return null;
    const boardId = this.resolveSsiBoardId(row.boardId);
    const exchange = this.mapSsiExchange(row.exchange);
    if (!exchange) return null;

    return {
      symbol,
      boardId,
      name: (row.companyNameVi ?? symbol).trim(),
      exchange,
      lotSize: Math.max(1, Math.trunc(toNum(row.tradingUnit) || 100)),
      isActive: true,
    };
  }

  private toSsiSnapshotSeed(
    row: SsiSymbol,
    tradingDate: string,
    stockIdByKey: Map<string, string>,
  ): QueryDeepPartialEntity<StockBoardSnapshot> | null {
    const symbol = (row.stockSymbol ?? '').trim().toUpperCase();
    if (!symbol) return null;
    const boardId = this.resolveSsiBoardId(row.boardId);
    const stockId = stockIdByKey.get(`${symbol}|${boardId}`);
    if (!stockId) return null;

    return {
      stockId,
      tradingDate,
      referencePrice: toNum(row.refPrice),
      ceilingPrice: toNum(row.ceiling),
      floorPrice: toNum(row.floor),
      openPrice: 0,
      highPrice: 0,
      lowPrice: 0,
      lastPrice: 0,
      lastVolume: 0,
      totalVolume: 0,
      totalValue: 0,
      bidPrice1: 0,
      bidPrice2: 0,
      bidPrice3: 0,
      bidVol1: 0,
      bidVol2: 0,
      bidVol3: 0,
      offerPrice1: 0,
      offerPrice2: 0,
      offerPrice3: 0,
      offerVol1: 0,
      offerVol2: 0,
      offerVol3: 0,
      totalBidQty: 0,
      totalOfferQty: 0,
      priceChange: 0,
      priceChangePct: 0,
    };
  }

  private mapSsiExchange(exchange: string | undefined): Exchange | null {
    const normalized = (exchange ?? '').trim().toUpperCase();
    if (normalized === 'HOSE') return Exchange.HOSE;
    if (normalized === 'HNX') return Exchange.HNX;
    if (normalized === 'UPCOM') return Exchange.UPCOM;
    return null;
  }

  private async refreshSymbolsCacheAfterIngest(
    tradingDate: string,
  ): Promise<void> {
    await this.clearOldSymbolsCacheKeys(tradingDate);
    await this.populateSymbolsCachesForTradingDate(tradingDate);
  }

  private async clearOldSymbolsCacheKeys(
    currentTradingDate: string,
  ): Promise<void> {
    const pastIngests = await this.ingestRepo.find({
      select: ['tradingDate'],
      where: {
        source: MarketSnapshotSource.SSI,
        status: MarketSnapshotIngestStatus.SUCCESS,
      },
    });
    const oldTradingDates = [
      ...new Set(
        pastIngests
          .map((item) => item.tradingDate)
          .filter((tradingDate) => tradingDate !== currentTradingDate),
      ),
    ];
    if (oldTradingDates.length === 0) return;

    const scopes = ['ALL', Exchange.HOSE, Exchange.HNX, Exchange.UPCOM];
    await Promise.all(
      oldTradingDates.flatMap((tradingDate) =>
        scopes.map((scope) =>
          this.redis.del(marketSymbolsCacheKey(tradingDate, scope)),
        ),
      ),
    );
  }

  private resolveSsiBoardId(boardId: string | undefined): string {
    const normalized = (boardId ?? '').trim().toUpperCase();
    return normalized || DEFAULT_STOCK_BOARD_ID;
  }

  private async deleteSnapshotsOutsideTradingDate(
    currentTradingDate: string,
  ): Promise<void> {
    await this.snapshotRepo
      .createQueryBuilder()
      .delete()
      .from(StockBoardSnapshot)
      .where('trading_date <> :currentTradingDate', { currentTradingDate })
      .execute();
  }

  private async deleteStaleSnapshotsForTradingDate(
    activeStockIds: string[],
    currentTradingDate: string,
  ): Promise<void> {
    if (activeStockIds.length === 0) return;
    await this.snapshotRepo
      .createQueryBuilder()
      .delete()
      .from(StockBoardSnapshot)
      .where('trading_date = :currentTradingDate', { currentTradingDate })
      .andWhere('stock_id NOT IN (:...activeStockIds)', { activeStockIds })
      .execute();
  }

  private tradingDateYmdVN(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}
