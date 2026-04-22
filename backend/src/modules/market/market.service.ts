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
  marketQuotesCacheKey,
  CACHE_TTL_MARKET_QUOTES,
  DEFAULT_STOCK_BOARD_ID,
} from '../../common/const';
import { RedisService } from '../../redis/redis.service';
import { roundToTick, toNum } from './market-price.util';
import type { MarketInstrumentDto } from './dto/market-instrument.dto';

interface DepthLevel {
  price: number;
  vol: number;
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
    const tradingDate = this.tradingDateYmd();

    const where =
      symbols && symbols.toUpperCase() !== 'ALL'
        ? symbols
            .toUpperCase()
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null;

    const scope = where ? [...where].sort().join(',') : 'ALL';
    const cacheKey = marketQuotesCacheKey(tradingDate, scope);

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as object[];

    const stocks = await this.stockRepo.find({
      where: where
        ? where.map((symbol) => ({
            symbol,
            boardId: DEFAULT_STOCK_BOARD_ID,
            isActive: true,
          }))
        : { isActive: true, boardId: DEFAULT_STOCK_BOARD_ID },
      order: { symbol: 'ASC' },
    });

    await this.ensureSnapshotsForDate(stocks, tradingDate);

    const snaps = await this.snapshotRepo.find({
      where: { tradingDate },
      relations: { stock: true },
    });
    const snapByStockId = new Map(snaps.map((s) => [s.stockId, s]));

    const rows = stocks.map((stock) => {
      const snap = snapByStockId.get(stock.id);
      return {
        symbol: stock.symbol,
        exchange: stock.exchange,
        fullName: stock.name,
        reference: toNum(snap?.referencePrice ?? 0),
        ceiling: toNum(snap?.ceilingPrice ?? 0),
        floor: toNum(snap?.floorPrice ?? 0),
        tradeLot: stock.lotSize,
        priceStep: toNum(stock.tickSize),
        tradingDate: snap
          ? this.ymdToVN(snap.tradingDate)
          : this.formatVNDate(new Date()),
      };
    });

    await this.redis.set(
      cacheKey,
      JSON.stringify(rows),
      CACHE_TTL_MARKET_QUOTES,
    );
    return rows;
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
   * Đảm bảo có dòng cho ngày hiện tại, rồi rebuild depth + phiên từ orders/trades.
   * @param exchange — lọc sàn: HOSE | HNX | UPCOM; bỏ trống = tất cả.
   */
  async getInstruments(exchange?: string): Promise<MarketInstrumentDto[]> {
    const now = new Date();
    const tradingDate = this.tradingDateYmd(now);
    const ex = exchange?.trim().toUpperCase();
    if (ex && !Object.values(Exchange).includes(ex as Exchange)) {
      throw new BadRequestException(
        `exchange không hợp lệ: ${exchange}. Cho phép: ${Object.values(Exchange).join(', ')}`,
      );
    }

    const stocks = await this.stockRepo.find({
      where: ex
        ? {
            isActive: true,
            boardId: DEFAULT_STOCK_BOARD_ID,
            exchange: ex as Exchange,
          }
        : { isActive: true, boardId: DEFAULT_STOCK_BOARD_ID },
      order: { symbol: 'ASC' },
    });
    if (stocks.length === 0) {
      return [];
    }

    await this.ensureSnapshotsForDate(stocks, tradingDate);
    await this.rebuildAllSnapshotsForDate(tradingDate, stocks);

    const snaps = await this.snapshotRepo.find({
      where: { tradingDate, stockId: In(stocks.map((s) => s.id)) },
      relations: { stock: true },
    });
    snaps.sort((a, b) =>
      (a.stock?.symbol ?? '').localeCompare(b.stock?.symbol ?? ''),
    );

    const ts = now.getTime();
    return snaps.map((s) => this.snapshotToDto(s, ts));
  }

  /** Gọi sau đặt/hủy lệnh (và sau khớp) để cập nhật 1 mã */
  async refreshBoardForStock(stockId: string): Promise<void> {
    const tradingDate = this.tradingDateYmd();
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
    const trades = await this.tradeRepo.find({
      where: { createdAt: MoreThanOrEqual(startOfDay) },
      relations: { buyOrder: true },
      order: { createdAt: 'ASC' },
    });
    const tlist = trades.filter((t) => t.buyOrder?.stockId === stockId);
    this.fillSnapshotFromOrdersAndTrades(snap, orders, tlist);
    await this.snapshotRepo.save(snap);
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

  private formatVNDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  /** Cột date DB `YYYY-MM-DD` → hiển thị dd/MM/yyyy (tránh lệch TZ khi dùng Date.parse) */
  private ymdToVN(ymd: string): string {
    const [y, m, d] = ymd.split('-');
    if (!y || !m || !d) return ymd;
    return `${d}/${m}/${y}`;
  }

  private startOfTradingDay(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async latestCloseForStock(stockId: string): Promise<number> {
    const ph = await this.priceRepo.findOne({
      where: { stockId },
      order: { date: 'DESC' },
    });
    return ph ? toNum(ph.close) : 0;
  }

  private async ensureSnapshotsForDate(
    stocks: Stock[],
    tradingDate: string,
  ): Promise<void> {
    for (const stock of stocks) {
      const exists = await this.snapshotRepo.exist({
        where: { stockId: stock.id, tradingDate },
      });
      if (exists) continue;

      const ref = await this.latestCloseForStock(stock.id);
      const tick = toNum(stock.tickSize);
      const cp = toNum(stock.ceilPct);
      const fp = toNum(stock.floorPct);
      const ceilP = ref > 0 ? roundToTick(ref * (1 + cp / 100), tick) : 0;
      const floorP = ref > 0 ? roundToTick(ref * (1 - fp / 100), tick) : 0;

      const snap = this.snapshotRepo.create({
        stockId: stock.id,
        tradingDate,
        referencePrice: ref,
        ceilingPrice: ceilP,
        floorPrice: floorP,
      });
      await this.snapshotRepo.save(snap);
    }
  }

  private async rebuildAllSnapshotsForDate(
    tradingDate: string,
    stocks: Stock[],
  ): Promise<void> {
    const startOfDay = this.startOfTradingDay();
    const stockIds = stocks.map((s) => s.id);

    const allOrders =
      stockIds.length > 0
        ? await this.orderRepo.find({
            where: {
              stockId: In(stockIds),
              status: In([OrderStatus.PENDING, OrderStatus.PARTIAL]),
            },
          })
        : [];

    const ordersByStock = this.groupOrdersByStock(allOrders);

    const tradesToday = await this.tradeRepo.find({
      where: { createdAt: MoreThanOrEqual(startOfDay) },
      relations: { buyOrder: true },
      order: { createdAt: 'ASC' },
    });
    const tradesByStock = this.groupTradesByStock(tradesToday);

    const snaps = await this.snapshotRepo.find({ where: { tradingDate } });
    for (const snap of snaps) {
      const orders = ordersByStock.get(snap.stockId) ?? [];
      const tlist = tradesByStock.get(snap.stockId) ?? [];
      this.fillSnapshotFromOrdersAndTrades(snap, orders, tlist);
    }
    if (snaps.length > 0) {
      await this.snapshotRepo.save(snaps);
    }
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

  private snapshotToDto(
    snap: StockBoardSnapshot,
    ts: number,
  ): MarketInstrumentDto {
    const stock = snap.stock;
    const reference = toNum(snap.referencePrice);
    const closePrice = toNum(snap.lastPrice);
    const change = reference > 0 ? closePrice - reference : 0;
    const changePercent =
      reference > 0 && closePrice > 0
        ? ((closePrice - reference) / reference) * 100
        : 0;
    const totalVol = snap.totalVolume ?? 0;
    const totalVal = toNum(snap.totalValue);
    const avgPrice = totalVol > 0 ? totalVal / totalVol : 0;

    return {
      symbol: stock?.symbol ?? '',
      stockId: snap.stockId,
      fullName: stock?.name ?? '',
      tradingDate: this.ymdToVN(snap.tradingDate),
      exchange: stock?.exchange ?? '',
      ceiling: toNum(snap.ceilingPrice),
      floor: toNum(snap.floorPrice),
      reference,
      bidPrice3: toNum(snap.bidPrice3),
      bidVol3: snap.bidVol3,
      bidPrice2: toNum(snap.bidPrice2),
      bidVol2: snap.bidVol2,
      bidPrice1: toNum(snap.bidPrice1),
      bidVol1: snap.bidVol1,
      offerPrice1: toNum(snap.offerPrice1),
      offerVol1: snap.offerVol1,
      offerPrice2: toNum(snap.offerPrice2),
      offerVol2: snap.offerVol2,
      offerPrice3: toNum(snap.offerPrice3),
      offerVol3: snap.offerVol3,
      closePrice,
      closeVol: snap.lastVolume,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      totalTrading: totalVol,
      totalTradingValue: totalVal,
      averagePrice: Math.round(avgPrice * 100) / 100,
      open: toNum(snap.openPrice),
      high: toNum(snap.highPrice),
      low: toNum(snap.lowPrice),
      foreignBuy: 0,
      foreignSell: 0,
      foreignRemain: 0,
      foreignRoom: 0,
      TOTAL_OFFER_QTTY: snap.totalOfferQty,
      TOTAL_BID_QTTY: snap.totalBidQty,
      tradingSessionId: 'MOCK_CONTINUOUS',
      ts,
      kid: `${ts}-${randomBytes(8).toString('hex')}`,
    };
  }

  private groupOrdersByStock(orders: Order[]): Map<string, Order[]> {
    const m = new Map<string, Order[]>();
    for (const o of orders) {
      const arr = m.get(o.stockId) ?? [];
      arr.push(o);
      m.set(o.stockId, arr);
    }
    return m;
  }

  private groupTradesByStock(trades: Trade[]): Map<string, Trade[]> {
    const m = new Map<string, Trade[]>();
    for (const t of trades) {
      const sid = t.buyOrder?.stockId;
      if (!sid) continue;
      const arr = m.get(sid) ?? [];
      arr.push(t);
      m.set(sid, arr);
    }
    return m;
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
}
