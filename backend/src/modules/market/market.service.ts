import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import {
  Exchange,
  OrderSide,
  OrderStatus,
  CacheKey,
  CacheTtl,
  marketSymbolsCacheKey,
  DEFAULT_STOCK_BOARD_ID,
} from '../../common/const';
import { RedisService } from '../../redis/redis.service';
import { roundToTick, toNum } from './market-price.util';
import type { MarketInstrumentDto } from './dto/market-instrument.dto';

interface DepthLevel {
  price: number;
  vol: number;
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
  sessionCode: string | null;
  priceChange: number;
  priceChangePct: number;
}

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(PriceHistory) private priceRepo: Repository<PriceHistory>,
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Trade) private tradeRepo: Repository<Trade>,
    @InjectRepository(StockBoardSnapshot)
    private snapshotRepo: Repository<StockBoardSnapshot>,
    private redis: RedisService,
  ) {}

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

  /** Gọi sau đặt/hủy lệnh (và sau khớp) để cập nhật 1 mã */
  async refreshBoardForStock(stockId: string): Promise<void> {
    const tradingDate = await this.resolveActiveTradingDate();
    const stock = await this.stockRepo.findOne({ where: { id: stockId } });
    if (!stock) return;
    await this.ensureSnapshotsForDate([stock], tradingDate);
    const snap = await this.snapshotRepo.findOne({
      where: { stockId, tradingDate },
    });
    if (!snap) return;

    const startOfDay = this.startOfTradingDay();
    const orders = await this.orderRepo.find({
      where: {
        stockId,
        status: In([OrderStatus.PENDING, OrderStatus.PARTIAL]),
      },
    });
    const trades = await this.tradeRepo
      .createQueryBuilder('trade')
      .innerJoin('trade.buyOrder', 'buyOrder')
      .where('trade.createdAt >= :startOfDay', { startOfDay })
      .andWhere('buyOrder.stockId = :stockId', { stockId })
      .orderBy('trade.createdAt', 'ASC')
      .getMany();
    this.fillSnapshotFromOrdersAndTrades(snap, orders, trades);
    await this.snapshotRepo.save(snap);
    await this.invalidateSymbolsCache(tradingDate, stock.exchange);
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

  private startOfTradingDay(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async ensureSnapshotsForDate(
    stocks: Stock[],
    tradingDate: string,
  ): Promise<void> {
    const latestCloseByStockId = await this.latestCloseByStockIds(
      stocks.map((stock) => stock.id),
    );

    for (const stock of stocks) {
      const ref = latestCloseByStockId.get(stock.id) ?? 0;
      const tick = toNum(stock.tickSize);
      const cp = toNum(stock.ceilPct);
      const fp = toNum(stock.floorPct);
      const ceilP = ref > 0 ? roundToTick(ref * (1 + cp / 100), tick) : 0;
      const floorP = ref > 0 ? roundToTick(ref * (1 - fp / 100), tick) : 0;

      // INSERT ... ON CONFLICT DO NOTHING — tránh race condition TOCTOU khi nhiều request đồng thời
      await this.snapshotRepo
        .createQueryBuilder()
        .insert()
        .into(StockBoardSnapshot)
        .values({
          stockId: stock.id,
          tradingDate,
          referencePrice: ref,
          ceilingPrice: ceilP,
          floorPrice: floorP,
        })
        .orIgnore()
        .execute();
    }
  }

  private async latestCloseByStockIds(
    stockIds: string[],
  ): Promise<Map<string, number>> {
    if (stockIds.length === 0) return new Map();
    const latestPrices = await this.priceRepo
      .createQueryBuilder('price')
      .distinctOn(['price.stockId'])
      .where('price.stockId IN (:...stockIds)', { stockIds })
      .orderBy('price.stockId', 'ASC')
      .addOrderBy('price.date', 'DESC')
      .getMany();

    return new Map(
      latestPrices.map((price) => [price.stockId, toNum(price.close)]),
    );
  }

  private async resolveActiveTradingDate(now = new Date()): Promise<string> {
    const raw = await this.snapshotRepo
      .createQueryBuilder('snapshot')
      .select('MAX(snapshot.tradingDate)', 'maxTradingDate')
      .getRawOne<{ maxTradingDate: string | null }>();

    if (raw?.maxTradingDate) return raw.maxTradingDate;
    return this.tradingDateYmd(now);
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

    await this.ensureSnapshotsForDate(stocks, tradingDate);
    const snaps = await this.snapshotRepo.find({
      where: { tradingDate, stockId: In(stocks.map((s) => s.id)) },
    });
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
        tradingDate,
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
        sessionCode: snap?.sessionCode ?? null,
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
      tradingSessionId: row.sessionCode ?? 'MOCK_CONTINUOUS',
      ts,
      kid: `${ts}-${randomBytes(8).toString('hex')}`,
    };
  }

  private fillSnapshotFromOrdersAndTrades(
    snap: StockBoardSnapshot,
    orders: Order[],
    tradesAsc: Trade[],
  ): void {
    const session = this.aggregateSession(tradesAsc);
    const depth = this.computeDepth(orders);

    snap.openPrice = session.open;
    snap.highPrice = session.high;
    snap.lowPrice = session.low;
    snap.lastPrice = session.lastPrice;
    snap.lastVolume = session.lastVol;
    snap.totalVolume = session.totalVol;
    snap.totalValue = session.totalVal;

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

  private async invalidateSymbolsCache(
    tradingDate: string,
    exchange: Exchange,
  ): Promise<void> {
    await Promise.all([
      this.redis.del(marketSymbolsCacheKey(tradingDate, 'ALL')),
      this.redis.del(marketSymbolsCacheKey(tradingDate, exchange)),
    ]);
  }
}
