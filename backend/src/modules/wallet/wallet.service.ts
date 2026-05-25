import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
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
import { resolveTradingAccountForUser } from '../../common/utils/resolve-trading-account.util';

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
    private readonly config: ConfigService,
  ) {}

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

  getInitialWalletBalance(): number {
    const raw = this.config.get<string>('INITIAL_WALLET_BALANCE');
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return 50_000_000;
  }

  /** Ledger nạp tiền + position quà — dùng khi tạo TK mới (đăng ký / seed). */
  async applyNewAccountGift(
    manager: EntityManager,
    wallet: Wallet,
    balance: number,
    options?: { throwIfStockMissing?: boolean },
  ): Promise<void> {
    await manager.save(
      manager.create(CashTransaction, {
        walletId: wallet.id,
        type: TransactionType.DEPOSIT,
        amount: balance,
        balanceAfter: balance,
        description: 'Tiền khởi tạo tài khoản',
      }),
    );

    await this.ensureGiftPosition(manager, wallet.tradingAccountId, options);
  }

  /** Bổ sung quà cho TK seed cũ (số dư 0 / chưa có VCB). */
  async backfillGiftIfNeeded(
    manager: EntityManager,
    wallet: Wallet,
  ): Promise<void> {
    const targetBalance = this.getInitialWalletBalance();
    const current = Number(wallet.availableBalance);

    if (current < targetBalance) {
      const topUp = targetBalance - current;
      wallet.availableBalance = targetBalance;
      wallet.lockedBalance = Number(wallet.lockedBalance);
      await manager.save(Wallet, wallet);
      await manager.save(
        manager.create(CashTransaction, {
          walletId: wallet.id,
          type: TransactionType.DEPOSIT,
          amount: topUp,
          balanceAfter:
            Number(wallet.availableBalance) + Number(wallet.lockedBalance),
          description: 'Bổ sung tiền khởi tạo tài khoản',
        }),
      );
      this.logger.log(
        `Backfill tiền ví ${wallet.id}: +${topUp} → ${targetBalance}`,
      );
    }

    await this.ensureGiftPosition(manager, wallet.tradingAccountId, {
      throwIfStockMissing: false,
    });
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

    await manager.save(
      manager.create(Position, {
        tradingAccountId,
        stockId: stock.id,
        quantity: this.getGiftStockQty(),
        lockedQuantity: 0,
        avgPrice,
      }),
    );
    this.logger.log(
      `Quà cổ phiếu ${symbol} x${this.getGiftStockQty()} cho TK ${tradingAccountId}`,
    );
  }
}
