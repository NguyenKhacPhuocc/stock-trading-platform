import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { DEFAULT_STOCK_BOARD_ID, TransactionType } from '../../common/const';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';
import { Stock } from '../../database/entities/stock.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { BusinessException } from '../../common/errors/business.exception';
import type {
  PortfolioOverviewDto,
  PortfolioPositionRowDto,
} from './dto/portfolio-overview.dto';
import type { CashStatementDto } from './dto/cash-statement.dto';
import type { StockStatementDto } from './dto/stock-statement.dto';
import type { SellFillsDto } from './dto/sell-fills.dto';
import type { AccountTradesDto } from './dto/account-trades.dto';
import { PositionTransaction } from '../../database/entities/position-transaction.entity';
import { Order } from '../../database/entities/order.entity';
import { backfillPositionLedgerForAccount } from './util/position-ledger-backfill.util';
import { PortfolioNavSnapshot } from '../../database/entities/portfolio-nav-snapshot.entity';
import { StockLedgerType } from '../../common/const/stock-ledger';
import { recordPositionLedger } from '../../common/utils/record-position-ledger.util';
import { resolveTradingAccountForUser } from '../../common/utils/resolve-trading-account.util';
import { walletLedgerSnapshot } from '../../common/utils/wallet-ledger-snapshot.util';
import { vnDateRangeToUtcBounds, toUtcIsoString } from '../../common/utils/vn-time.util';
import { Trade } from '../../database/entities/trade.entity';
import { backfillMissingTradeRealizedPnl } from './util/trade-realized-pnl-backfill.util';
import type { SellFillsBySymbolDto } from './dto/sell-fills.dto';

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pctChange(part: number, whole: number): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(Position) private positionRepo: Repository<Position>,
    @InjectRepository(TradingAccount)
    private accountRepo: Repository<TradingAccount>,
    @InjectRepository(StockBoardSnapshot)
    private snapshotRepo: Repository<StockBoardSnapshot>,
    @InjectRepository(CashTransaction)
    private cashTxRepo: Repository<CashTransaction>,
    @InjectRepository(Trade)
    private tradeRepo: Repository<Trade>,
    @InjectRepository(PositionTransaction)
    private positionTxRepo: Repository<PositionTransaction>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(PortfolioNavSnapshot)
    private navSnapshotRepo: Repository<PortfolioNavSnapshot>,
    private readonly config: ConfigService,
  ) {}

  private async ensurePositionLedgerBackfill(
    tradingAccountId: string,
  ): Promise<void> {
    const n = await backfillPositionLedgerForAccount(
      this.positionTxRepo,
      this.orderRepo,
      this.tradeRepo,
      this.positionRepo,
      tradingAccountId,
    );
    if (n > 0) {
      this.logger.log(`Backfill sao kê CP: ${n} dòng cho TK ${tradingAccountId}`);
    }
  }

  async getWallet(userId: string, tradingAccountId: string) {
    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    const wallet = await this.walletRepo.findOne({
      where: { tradingAccountId: account.id },
      relations: { transactions: true },
      order: { transactions: { createdAt: 'DESC' } },
    });
    if (!wallet) {
      throw new BusinessException('WALLET_NOT_FOUND', undefined, 404);
    }
    const available = Number(wallet.availableBalance);
    const locked = Number(wallet.lockedBalance);
    return {
      ...wallet,
      accountId: account.accountId,
      totalBalance: available + locked,
    };
  }

  async getCashStatement(
    userId: string,
    tradingAccountId: string,
    from?: string,
    to?: string,
    limitRaw?: string,
    offsetRaw?: string,
  ): Promise<CashStatementDto> {
    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    const wallet = await this.walletRepo.findOne({
      where: { tradingAccountId: account.id },
    });
    if (!wallet) {
      throw new BusinessException('WALLET_NOT_FOUND', undefined, 404);
    }

    const range = vnDateRangeToUtcBounds(from, to);
    const limit = Math.min(
      100,
      Math.max(1, limitRaw ? parseInt(limitRaw, 10) || 30 : 30),
    );
    const offset = Math.max(0, offsetRaw ? parseInt(offsetRaw, 10) || 0 : 0);

    const qb = this.cashTxRepo
      .createQueryBuilder('tx')
      .where('tx.walletId = :walletId', { walletId: wallet.id })
      .orderBy('tx.createdAt', 'DESC');

    if (range.start) {
      qb.andWhere('tx.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      qb.andWhere('tx.createdAt <= :end', { end: range.end });
    }

    const sumQb = this.cashTxRepo
      .createQueryBuilder('tx')
      .select(
        'COALESCE(SUM(CASE WHEN tx.amount > 0 THEN tx.amount ELSE 0 END), 0)',
        'totalIn',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN tx.amount < 0 THEN tx.amount ELSE 0 END), 0)',
        'totalOut',
      )
      .where('tx.walletId = :walletId', { walletId: wallet.id });
    if (range.start) {
      sumQb.andWhere('tx.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      sumQb.andWhere('tx.createdAt <= :end', { end: range.end });
    }
    const sumRaw = await sumQb.getRawOne<{
      totalIn: string;
      totalOut: string;
    }>();
    const totalIn = toNum(sumRaw?.totalIn);
    const totalOut = toNum(sumRaw?.totalOut);

    const [rows, total] = await qb
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return {
      accountId: account.accountId,
      items: rows.map((tx) => ({
        id: tx.id,
        createdAt: toUtcIsoString(tx.createdAt),
        type: tx.type,
        amount: toNum(tx.amount),
        availableAfter: toNum(
          tx.availableAfter != null ? tx.availableAfter : tx.balanceAfter,
        ),
        balanceAfter: toNum(tx.balanceAfter),
        description: tx.description,
        refOrderId: tx.refOrderId,
      })),
      total,
      limit,
      offset,
      summary: {
        totalIn,
        totalOut,
        netFlow: totalIn + totalOut,
      },
    };
  }

  /** Sao kê biến động khối lượng CP theo tiểu khoản. */
  async getStockStatement(
    userId: string,
    tradingAccountId: string,
    from?: string,
    to?: string,
    limitRaw?: string,
    offsetRaw?: string,
    symbol?: string,
  ): Promise<StockStatementDto> {
    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    await this.ensurePositionLedgerBackfill(account.id);

    const range = vnDateRangeToUtcBounds(from, to);
    const limit = Math.min(
      100,
      Math.max(1, limitRaw ? parseInt(limitRaw, 10) || 30 : 30),
    );
    const offset = Math.max(0, offsetRaw ? parseInt(offsetRaw, 10) || 0 : 0);
    const sym = symbol?.trim().toUpperCase();

    const qb = this.positionTxRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.stock', 'stock')
      .where('tx.tradingAccountId = :aid', { aid: account.id })
      .orderBy('tx.createdAt', 'DESC');

    if (range.start) {
      qb.andWhere('tx.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      qb.andWhere('tx.createdAt <= :end', { end: range.end });
    }
    if (sym) {
      qb.andWhere('UPPER(stock.symbol) = :sym', { sym });
    }

    const netExpr = '(tx.quantity_delta + tx.locked_delta)';
    const sumQb = this.positionTxRepo
      .createQueryBuilder('tx')
      .leftJoin('tx.stock', 'stock')
      .select(
        `COALESCE(SUM(CASE WHEN ${netExpr} > 0 THEN ${netExpr} ELSE 0 END), 0)`,
        'totalIncrease',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${netExpr} < 0 THEN ${netExpr} ELSE 0 END), 0)`,
        'totalDecrease',
      )
      .where('tx.tradingAccountId = :aid', { aid: account.id });
    if (range.start) {
      sumQb.andWhere('tx.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      sumQb.andWhere('tx.createdAt <= :end', { end: range.end });
    }
    if (sym) {
      sumQb.andWhere('UPPER(stock.symbol) = :sym', { sym });
    }
    const sumRaw = await sumQb.getRawOne<{
      totalIncrease: string;
      totalDecrease: string;
    }>();
    const totalIncrease = toNum(sumRaw?.totalIncrease);
    const totalDecrease = toNum(sumRaw?.totalDecrease);

    const [rows, total] = await qb.take(limit).skip(offset).getManyAndCount();

    return {
      accountId: account.accountId,
      items: rows.map((tx) => {
        const quantityAfter = Number(tx.quantityAfter) || 0;
        const lockedAfter = Number(tx.lockedAfter) || 0;
        return {
          id: tx.id,
          createdAt: toUtcIsoString(tx.createdAt),
          symbol: tx.stock?.symbol ?? '—',
          type: tx.type,
          quantityDelta: Number(tx.quantityDelta) || 0,
          lockedDelta: Number(tx.lockedDelta) || 0,
          quantityAfter,
          lockedAfter,
          totalAfter: quantityAfter + lockedAfter,
          description: tx.description,
          refOrderId: tx.refOrderId,
        };
      }),
      total,
      limit,
      offset,
      summary: {
        totalIncrease,
        totalDecrease,
        netQuantity: totalIncrease + totalDecrease,
      },
    };
  }

  private async ensureTradeRealizedPnlBackfill(): Promise<void> {
    const nullCount = await this.tradeRepo.count({
      where: { costBasisPrice: IsNull() },
    });
    if (nullCount === 0) return;
    const n = await backfillMissingTradeRealizedPnl(
      this.tradeRepo,
      this.positionRepo,
    );
    if (n > 0) {
      this.logger.log(`Backfill giá vốn/Lãi/Lỗ đã thực hiện cho ${n} khớp bán`);
    }
  }

  /** Khớp bán + lãi/lỗ đã thực hiện (WAC tại thời điểm bán). */
  async getSellFills(
    userId: string,
    tradingAccountId: string,
    from?: string,
    to?: string,
    limitRaw?: string,
    offsetRaw?: string,
  ): Promise<SellFillsDto> {
    await this.ensureTradeRealizedPnlBackfill();

    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    const range = vnDateRangeToUtcBounds(from, to);
    const limit = Math.min(
      100,
      Math.max(1, limitRaw ? parseInt(limitRaw, 10) || 30 : 30),
    );
    const offset = Math.max(0, offsetRaw ? parseInt(offsetRaw, 10) || 0 : 0);

    const sumQb = this.tradeRepo
      .createQueryBuilder('t')
      .innerJoin('t.sellOrder', 'o')
      .where('o.tradingAccountId = :aid', { aid: account.id });
    if (range.start) {
      sumQb.andWhere('t.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      sumQb.andWhere('t.createdAt <= :end', { end: range.end });
    }
    const sumRaw = await sumQb
      .select('COUNT(*)', 'tradeCount')
      .addSelect('COALESCE(SUM(t.trade_value), 0)', 'totalSellValue')
      .addSelect(
        `COALESCE(SUM(
          CASE WHEN t.cost_basis_price IS NOT NULL
            THEN t.cost_basis_price * t.quantity ELSE 0 END
        ), 0)`,
        'totalCostAmount',
      )
      .addSelect(
        `COALESCE(SUM(
          CASE
            WHEN t.realized_pnl IS NOT NULL THEN t.realized_pnl
            WHEN t.cost_basis_price IS NOT NULL
              THEN (t.price - t.cost_basis_price) * t.quantity
            ELSE 0
          END
        ), 0)`,
        'totalRealizedPnL',
      )
      .getRawOne<{
        tradeCount: string;
        totalSellValue: string;
        totalCostAmount: string;
        totalRealizedPnL: string;
      }>();

    const qb = this.tradeRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.sellOrder', 'o')
      .leftJoinAndSelect('o.stock', 'stock')
      .where('o.tradingAccountId = :aid', { aid: account.id })
      .orderBy('t.createdAt', 'DESC');
    if (range.start) {
      qb.andWhere('t.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      qb.andWhere('t.createdAt <= :end', { end: range.end });
    }

    const [rows, total] = await qb.take(limit).skip(offset).getManyAndCount();

    const bySymbolQb = this.tradeRepo
      .createQueryBuilder('t')
      .innerJoin('t.sellOrder', 'o')
      .leftJoin('o.stock', 'stock')
      .where('o.tradingAccountId = :aid', { aid: account.id })
      .andWhere('t.cost_basis_price IS NOT NULL');
    if (range.start) {
      bySymbolQb.andWhere('t.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      bySymbolQb.andWhere('t.createdAt <= :end', { end: range.end });
    }
    const bySymbolRaw = await bySymbolQb
      .select('COALESCE(stock.symbol, \'—\')', 'symbol')
      .addSelect('COUNT(*)', 'tradeCount')
      .addSelect('COALESCE(SUM(t.quantity), 0)', 'quantity')
      .addSelect('COALESCE(SUM(t.trade_value), 0)', 'sellValue')
      .addSelect(
        'COALESCE(SUM(t.cost_basis_price * t.quantity), 0)',
        'costAmount',
      )
      .addSelect('COALESCE(SUM(t.realized_pnl), 0)', 'realizedPnL')
      .groupBy('stock.symbol')
      .orderBy('COALESCE(SUM(t.realized_pnl), 0)', 'DESC')
      .getRawMany<{
        symbol: string;
        tradeCount: string;
        quantity: string;
        sellValue: string;
        costAmount: string;
        realizedPnL: string;
      }>();

    const bySymbol: SellFillsBySymbolDto[] = bySymbolRaw.map((r) => {
      const costAmount = toNum(r.costAmount);
      const realizedPnL = toNum(r.realizedPnL);
      return {
        symbol: r.symbol,
        tradeCount: Number(r.tradeCount) || 0,
        quantity: Number(r.quantity) || 0,
        sellValue: toNum(r.sellValue),
        costAmount,
        realizedPnL,
      };
    });

    return {
      accountId: account.accountId,
      items: rows.map((t) => {
        const qty = Number(t.quantity) || 0;
        const price = toNum(t.price);
        const tradeValue = toNum(t.tradeValue);
        const costBasisPrice = toNum(t.costBasisPrice);
        const costAmount = costBasisPrice * qty;
        const realizedPnL =
          t.realizedPnL != null
            ? toNum(t.realizedPnL)
            : costBasisPrice > 0
              ? (price - costBasisPrice) * qty
              : 0;
        return {
          id: t.id,
          tradedAt: toUtcIsoString(t.createdAt),
          symbol: t.sellOrder?.stock?.symbol ?? '—',
          quantity: qty,
          price,
          tradeValue,
          costBasisPrice,
          costAmount,
          realizedPnL,
          realizedPnLPercent: pctChange(realizedPnL, costAmount),
        };
      }),
      total,
      limit,
      offset,
      summary: {
        tradeCount: Number(sumRaw?.tradeCount) || 0,
        totalSellValue: toNum(sumRaw?.totalSellValue),
        totalCostAmount: toNum(sumRaw?.totalCostAmount),
        totalRealizedPnL: toNum(sumRaw?.totalRealizedPnL),
      },
      bySymbol,
    };
  }

  async getAccountTrades(
    userId: string,
    tradingAccountId: string,
    fromDate?: string,
    toDate?: string,
    limitRaw?: string,
    offsetRaw?: string,
    symbol?: string,
  ): Promise<AccountTradesDto> {
    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    const limit = Math.max(1, Math.min(100, Number(limitRaw) || 20));
    const offset = Math.max(0, Number(offsetRaw) || 0);
    const range = vnDateRangeToUtcBounds(fromDate, toDate);

    const sumQb = this.tradeRepo
      .createQueryBuilder('t')
      .leftJoin('t.buyOrder', 'buy')
      .leftJoin('t.sellOrder', 'sell')
      .where(
        '(buy.tradingAccountId = :aid OR sell.tradingAccountId = :aid)',
        { aid: account.id },
      );
    if (range.start) {
      sumQb.andWhere('t.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      sumQb.andWhere('t.createdAt <= :end', { end: range.end });
    }
    if (symbol?.trim()) {
      sumQb
        .leftJoin('buy.stock', 'stockBuy')
        .leftJoin('sell.stock', 'stockSell')
        .andWhere(
          '(UPPER(stockBuy.symbol) = :sym OR UPPER(stockSell.symbol) = :sym)',
          { sym: symbol.trim().toUpperCase() },
        );
    }

    const sumRaw = await sumQb
      .select('COUNT(*)', 'tradeCount')
      .addSelect(
        `COALESCE(SUM(CASE WHEN buy.tradingAccountId = '${account.id}' THEN t.trade_value ELSE 0 END), 0)`,
        'totalBuyValue',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN sell.tradingAccountId = '${account.id}' THEN t.trade_value ELSE 0 END), 0)`,
        'totalSellValue',
      )
      .getRawOne<{
        tradeCount: string;
        totalBuyValue: string;
        totalSellValue: string;
      }>();

    const qb = this.tradeRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.buyOrder', 'buy')
      .leftJoinAndSelect('t.sellOrder', 'sell')
      .leftJoinAndSelect('buy.stock', 'stockBuy')
      .leftJoinAndSelect('sell.stock', 'stockSell')
      .where(
        '(buy.tradingAccountId = :aid OR sell.tradingAccountId = :aid)',
        { aid: account.id },
      )
      .orderBy('t.createdAt', 'DESC');

    if (range.start) {
      qb.andWhere('t.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      qb.andWhere('t.createdAt <= :end', { end: range.end });
    }
    if (symbol?.trim()) {
      qb.andWhere(
        '(UPPER(stockBuy.symbol) = :sym OR UPPER(stockSell.symbol) = :sym)',
        { sym: symbol.trim().toUpperCase() },
      );
    }

    const [rows, total] = await qb.take(limit).skip(offset).getManyAndCount();

    return {
      accountId: account.accountId,
      items: rows.map((t) => {
        const isBuyer = t.buyOrder?.tradingAccountId === account.id;
        const side = isBuyer ? 'buy' : 'sell';
        const stock = isBuyer ? t.buyOrder?.stock : t.sellOrder?.stock;
        return {
          id: t.id,
          tradedAt: toUtcIsoString(t.createdAt),
          symbol: stock?.symbol ?? '—',
          side,
          quantity: Number(t.quantity) || 0,
          price: toNum(t.price),
          tradeValue: toNum(t.tradeValue),
        };
      }),
      total,
      limit,
      offset,
      summary: {
        tradeCount: Number(sumRaw?.tradeCount) || 0,
        totalBuyValue: toNum(sumRaw?.totalBuyValue),
        totalSellValue: toNum(sumRaw?.totalSellValue),
      },
    };
  }

  async getPortfolioOverview(
    userId: string,
    tradingAccountId: string,
  ): Promise<PortfolioOverviewDto> {
    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    const wallet = await this.walletRepo.findOne({
      where: { tradingAccountId: account.id },
    });
    if (!wallet) {
      throw new BusinessException('WALLET_NOT_FOUND', undefined, 404);
    }

    const available = toNum(wallet.availableBalance);
    const locked = toNum(wallet.lockedBalance);
    const cashTotal = available + locked;

    const rows = await this.positionRepo.find({
      where: { tradingAccountId: account.id },
      relations: { stock: true },
    });

    const active = rows.filter(
      (p) => toNum(p.quantity) + toNum(p.lockedQuantity) > 0,
    );
    const stockIds = active.map((p) => p.stockId);
    const snapByStock = await this.loadLatestSnapshots(stockIds);

    const positions: PortfolioPositionRowDto[] = [];
    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let totalUnrealized = 0;
    let totalDayPnL = 0;

    for (const p of active) {
      const qty = toNum(p.quantity);
      const lockedQty = toNum(p.lockedQuantity);
      const totalQty = qty + lockedQty;
      const avgPrice = toNum(p.avgPrice);
      const snap = snapByStock.get(p.stockId);
      const refPrice = snap ? toNum(snap.referencePrice) : avgPrice;
      const lastPrice = snap ? toNum(snap.lastPrice) : refPrice;
      const marketPrice = lastPrice > 0 ? lastPrice : refPrice > 0 ? refPrice : avgPrice;

      const costBasis = avgPrice * totalQty;
      const marketValue = marketPrice * totalQty;
      const unrealizedPnL = marketValue - costBasis;
      const dayPnL = (marketPrice - refPrice) * totalQty;

      totalMarketValue += marketValue;
      totalCostBasis += costBasis;
      totalUnrealized += unrealizedPnL;
      totalDayPnL += dayPnL;

      const symbol = p.stock?.symbol ?? '';
      positions.push({
        stockId: p.stockId,
        symbol,
        exchange: String(p.stock?.exchange ?? 'HOSE'),
        quantity: qty,
        lockedQuantity: lockedQty,
        totalQuantity: totalQty,
        avgPrice,
        referencePrice: refPrice,
        marketPrice,
        marketValue,
        costBasis,
        unrealizedPnL,
        unrealizedPnLPercent: pctChange(unrealizedPnL, costBasis),
        dayPnL,
        dayChangePercent: pctChange(marketPrice - refPrice, refPrice),
      });
    }

    positions.sort((a, b) => b.marketValue - a.marketValue);

    const nav = cashTotal + totalMarketValue;
    const navAtRef =
      cashTotal +
      positions.reduce((s, r) => s + r.referencePrice * r.totalQuantity, 0);

    return {
      accountId: account.accountId,
      cash: { available, locked, total: cashTotal },
      summary: {
        nav,
        totalMarketValue,
        totalCostBasis,
        unrealizedPnL: totalUnrealized,
        unrealizedPnLPercent: pctChange(totalUnrealized, totalCostBasis),
        dayPnL: totalDayPnL,
        dayPnLPercent: pctChange(totalDayPnL, navAtRef > 0 ? navAtRef : nav),
        positionCount: positions.length,
      },
      positions,
    };
  }

  private async loadLatestSnapshots(
    stockIds: string[],
  ): Promise<Map<string, StockBoardSnapshot>> {
    const map = new Map<string, StockBoardSnapshot>();
    if (stockIds.length === 0) return map;

    const snaps = await this.snapshotRepo.find({
      where: { stockId: In(stockIds) },
      order: { tradingDate: 'DESC' },
    });
    for (const s of snaps) {
      if (!map.has(s.stockId)) map.set(s.stockId, s);
    }
    return map;
  }

  async getPositions(userId: string, tradingAccountId: string) {
    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    const rows = await this.positionRepo.find({
      where: { tradingAccountId: account.id },
      relations: { stock: true },
    });
    return rows.map((p) => {
      const available = Number(p.quantity);
      const locked = Number(p.lockedQuantity);
      return {
        ...p,
        quantity: available,
        lockedQuantity: locked,
        totalQuantity: available + locked,
      };
    });
  }

  /**
   * Quà cổ phiếu đăng ký (nếu cấu hình) — không nạp tiền.
   * Nạp tiền chỉ qua API nạp riêng (sẽ triển khai).
   */
  async ensureRegisterGiftStock(
    manager: EntityManager,
    tradingAccountId: string,
    options?: { throwIfStockMissing?: boolean },
  ): Promise<void> {
    await this.ensureGiftPosition(manager, tradingAccountId, options);
  }

  private getGiftStockQty(): number {
    const raw = this.config.get<string>('REGISTER_GIFT_STOCK_QTY');
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
    return 10_000;
  }

  private getGiftStockSymbol(): string {
    return (this.config.get<string>('REGISTER_GIFT_STOCK_SYMBOL') ?? 'VCB')
      .trim()
      .toUpperCase();
  }

  private async ensureGiftPosition(
    manager: EntityManager,
    tradingAccountId: string,
    options?: { throwIfStockMissing?: boolean },
  ): Promise<void> {
    const symbol = this.getGiftStockSymbol();
    const stock = await manager.findOne(Stock, {
      where: { symbol, boardId: DEFAULT_STOCK_BOARD_ID },
    });
    if (!stock) {
      if (options?.throwIfStockMissing !== false) {
        throw new BusinessException(
          'AUTH_REGISTER_GIFT_STOCK_MISSING',
          { symbol },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      this.logger.warn(
        `Bỏ qua quà cổ phiếu ${symbol}: chưa có trong DB (chạy SSI sync).`,
      );
      return;
    }

    const existing = await manager.findOne(Position, {
      where: { tradingAccountId, stockId: stock.id },
    });
    if (existing) return;

    const snap = await manager.findOne(StockBoardSnapshot, {
      where: { stockId: stock.id },
      order: { tradingDate: 'DESC' },
    });
    const avgPrice = snap ? Number(snap.referencePrice) : 0;

    const giftQty = this.getGiftStockQty();
    const saved = await manager.save(
      manager.create(Position, {
        tradingAccountId,
        stockId: stock.id,
        quantity: giftQty,
        lockedQuantity: 0,
        avgPrice,
      }),
    );
    await recordPositionLedger(manager, {
      tradingAccountId,
      stockId: stock.id,
      type: StockLedgerType.GIFT,
      quantityDelta: giftQty,
      lockedDelta: 0,
      quantityAfter: giftQty,
      lockedAfter: 0,
      description: `Quà cổ phiếu ${symbol} x${giftQty}`,
    });
    this.logger.log(
      `Quà cổ phiếu ${symbol} x${giftQty} cho TK ${tradingAccountId} (position ${saved.id})`,
    );
  }

  async recordNavSnapshot(
    tradingAccountId: string,
    snapshotAt?: Date,
  ): Promise<void> {
    const timestamp = snapshotAt ?? new Date();

    // Query wallet + positions trực tiếp, không cần user auth
    const wallet = await this.walletRepo.findOne({
      where: { tradingAccountId },
    });
    if (!wallet) {
      this.logger.warn(`Wallet not found for TK ${tradingAccountId}`);
      return;
    }

    const positions = await this.positionRepo.find({
      where: { tradingAccountId },
      relations: { stock: true },
    });

    const available = toNum(wallet.availableBalance);
    const locked = toNum(wallet.lockedBalance);
    const cashTotal = available + locked;

    const activePositions = positions.filter(
      (p) => toNum(p.quantity) + toNum(p.lockedQuantity) > 0,
    );
    const stockIds = activePositions.map((p) => p.stockId);
    const snapByStock = await this.loadLatestSnapshots(stockIds);

    let stockValue = 0;
    let costBasis = 0;
    let unrealizedPnL = 0;

    for (const p of activePositions) {
      const qty = toNum(p.quantity);
      const lockedQty = toNum(p.lockedQuantity);
      const totalQty = qty + lockedQty;
      const avgPrice = toNum(p.avgPrice);
      const snap = snapByStock.get(p.stockId);
      const refPrice = snap ? toNum(snap.referencePrice) : avgPrice;
      const lastPrice = snap ? toNum(snap.lastPrice) : refPrice;
      const marketPrice =
        lastPrice > 0 ? lastPrice : refPrice > 0 ? refPrice : avgPrice;

      const posStockValue = totalQty * marketPrice;
      const posCost = totalQty * avgPrice;

      stockValue += posStockValue;
      costBasis += posCost;
      unrealizedPnL += posStockValue - posCost;
    }

    const nav = cashTotal + stockValue;

    await this.navSnapshotRepo.save({
      tradingAccountId,
      snapshotAt: timestamp,
      nav,
      cashTotal,
      stockValue,
      unrealizedPnL,
    });

    this.logger.log(
      `Ghi snapshot NAV ${nav.toLocaleString()} cho TK ${tradingAccountId}`,
    );
  }

  async getNavHistory(
    userId: string,
    tradingAccountId: string,
    fromDate?: string,
    toDate?: string,
    limitRaw?: string,
  ) {
    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    const limit = Math.max(1, Math.min(500, Number(limitRaw) || 100));
    const range = vnDateRangeToUtcBounds(fromDate, toDate);

    const qb = this.navSnapshotRepo
      .createQueryBuilder('s')
      .where('s.tradingAccountId = :aid', { aid: account.id })
      .orderBy('s.snapshotAt', 'ASC');

    if (range.start) {
      qb.andWhere('s.snapshotAt >= :start', { start: range.start });
    }
    if (range.end) {
      qb.andWhere('s.snapshotAt <= :end', { end: range.end });
    }

    const rows = await qb.take(limit).getMany();

    return {
      accountId: account.accountId,
      items: rows.map((s) => ({
        snapshotAt: toUtcIsoString(s.snapshotAt),
        nav: toNum(s.nav),
        cashTotal: toNum(s.cashTotal),
        stockValue: toNum(s.stockValue),
        unrealizedPnL: toNum(s.unrealizedPnL),
      })),
      total: rows.length,
    };
  }
}
