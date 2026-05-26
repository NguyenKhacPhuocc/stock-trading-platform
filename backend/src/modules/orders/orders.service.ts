import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { OrderType, OrderStatus, OrderSide, TransactionType } from '../../common/const';
import { Stock } from '../../database/entities/stock.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { User } from '../../database/entities/user.entity';
import { Position } from '../../database/entities/position.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { PreCheckOrderDto } from './dto/pre-check-order.dto';
import type { PreCheckOrderResult } from './dto/pre-check-order-result.dto';
import { MatchingService } from '../matching/matching.service';
import { formatCreateOrder, orderRef } from '../matching/util/order-flow-log.util';
import { BusinessException } from '../../common/errors/business.exception';
import { walletLedgerSnapshot } from '../../common/utils/wallet-ledger-snapshot.util';
import { StockLedgerType } from '../../common/const/stock-ledger';
import { recordPositionLedger } from '../../common/utils/record-position-ledger.util';
import type { AppErrorKey } from '../../common/errors/error-const';
import { isMakOrderType, resolveMakLimitPrice } from './util/mak-order.util';
import { RedisService } from '../../redis/redis.service';
import { CacheTtl } from '../../common/const/cache-keys';
import {
  orderIntentByTokenKey,
  orderIntentByTxKey,
  type StoredOrderIntent,
} from './util/order-intent.util';
import { resolveTradingAccountForUser } from '../../common/utils/resolve-trading-account.util';
import { vnDateRangeToUtcBounds } from '../../common/utils/vn-time.util';

/**
 * Đặt / hủy lệnh — ghi DB + khóa tài sản, rồi đẩy job khớp.
 * Luồng đầy đủ: DO-AN-SAN-CHUNG-KHOAN-TECH-SPEC.md §6.3.1
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Trade) private tradeRepo: Repository<Trade>,
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    @InjectRepository(StockBoardSnapshot)
    private snapshotRepo: Repository<StockBoardSnapshot>,
    @InjectRepository(TradingAccount)
    private accountRepo: Repository<TradingAccount>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(Position) private positionRepo: Repository<Position>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly matching: MatchingService,
    private readonly redis: RedisService,
    private dataSource: DataSource,
  ) {}

  /** Kiểm tra nghiệp vụ + tính giá/tổng tiền — không khóa tài sản, không INSERT lệnh. */
  async preCheckOrder(
    userId: string,
    dto: PreCheckOrderDto,
  ): Promise<PreCheckOrderResult> {
    const draft = await this.resolveOrderDraft(userId, dto);
    const requestId = randomUUID();
    const transactionId = randomUUID();
    const tokenId = randomUUID().replace(/-/g, '');

    const intent: StoredOrderIntent = {
      userId,
      tradingAccountId: draft.account.id,
      stockId: dto.stockId,
      side: dto.side,
      orderType: dto.orderType,
      quantity: dto.quantity,
      orderPrice: draft.orderPrice,
      requestId,
      tokenId,
      transactionId,
    };
    const payload = JSON.stringify(intent);
    const ttl = CacheTtl.ORDER_INTENT;
    await this.redis.set(orderIntentByTxKey(transactionId), payload, ttl);
    await this.redis.set(orderIntentByTokenKey(tokenId), transactionId, ttl);

    return { requestId, transactionId, tokenId };
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    await this.verifyTradingPin(userId, dto.pin);
    await this.consumeOrderIntent(userId, dto);
    const draft = await this.resolveOrderDraft(userId, dto);
    const { account, symbol: sym, orderPrice } = draft;
    const isMak = isMakOrderType(dto.orderType);
    const estimatedCost = draft.estimatedTotal;

    const existing = await this.orderRepo.findOne({
      where: { tradingAccountId: account.id, clientOrderId: dto.clientOrderId },
    });
    if (existing) return existing;

    this.logger.log(
      `[order-flow] ${formatCreateOrder(dto.side, dto.quantity, sym, orderPrice)}${isMak ? ' MAK' : ''} | account=${account.accountId}`,
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const orderCode = this.buildOrderCode();
      try {
        const saved = await this.dataSource.transaction(async (manager) => {
          if (dto.side === OrderSide.BUY) {
            const wallet = await manager.findOne(Wallet, {
              where: { tradingAccountId: account.id },
              lock: { mode: 'pessimistic_write' },
            });
            if (!wallet) {
              this.throwBusinessError('WALLET_NOT_FOUND', undefined, 404);
            }
            const available = Number(wallet.availableBalance);
            if (available < estimatedCost) {
              this.throwBusinessError('INSUFFICIENT_BALANCE');
            }
            wallet.availableBalance = available - estimatedCost;
            wallet.lockedBalance = Number(wallet.lockedBalance) + estimatedCost;
            await manager.save(wallet);

            const order = manager.create(Order, {
              orderCode,
              clientOrderId: dto.clientOrderId,
              tradingAccountId: account.id,
              stockId: dto.stockId,
              side: dto.side,
              orderType: dto.orderType,
              price: orderPrice,
              quantity: dto.quantity,
            });
            const persisted = await manager.save(order);
            await manager.save(
              manager.create(CashTransaction, {
                walletId: wallet.id,
                type: TransactionType.BUY_LOCK,
                amount: -estimatedCost,
                ...walletLedgerSnapshot(wallet),
                refOrderId: persisted.id,
                description: `Khóa tiền cho lệnh ${persisted.orderCode ?? persisted.id}${isMak ? ' (MAK)' : ''}`,
              }),
            );
            return persisted;
          }

          const position = await manager.findOne(Position, {
            where: { tradingAccountId: account.id, stockId: dto.stockId },
            lock: { mode: 'pessimistic_write' },
          });
          const availableQty = position ? Number(position.quantity) : 0;
          if (availableQty < Number(dto.quantity)) {
            this.throwBusinessError('INSUFFICIENT_SELLABLE_QTY');
          }
          const sellQty = Number(dto.quantity);
          if (position) {
            position.quantity = availableQty - sellQty;
            position.lockedQuantity =
              Number(position.lockedQuantity) + sellQty;
            await manager.save(position);
          }

          const order = manager.create(Order, {
            orderCode,
            clientOrderId: dto.clientOrderId,
            tradingAccountId: account.id,
            stockId: dto.stockId,
            side: dto.side,
            orderType: dto.orderType,
            price: orderPrice,
            quantity: dto.quantity,
          });
          const persisted = await manager.save(order);
          if (position) {
            await recordPositionLedger(manager, {
              tradingAccountId: account.id,
              stockId: dto.stockId,
              type: StockLedgerType.SELL_LOCK,
              quantityDelta: -sellQty,
              lockedDelta: sellQty,
              quantityAfter: Number(position.quantity),
              lockedAfter: Number(position.lockedQuantity),
              refOrderId: persisted.id,
              description: `Phong tỏa bán ${sellQty} CP — lệnh ${persisted.orderCode ?? persisted.id}`,
            });
          }
          return persisted;
        });
        this.logger.log(
          `[order-flow] order saved DB | ${orderRef(saved.id, saved.orderCode)} status=${saved.status}`,
        );
        await this.matching
          .enqueueAccepted(saved.id, saved.stockId, saved.orderCode, sym)
          .catch((e: unknown) =>
            this.logger.error(`[order-flow] enqueue failed: ${String(e)}`),
          );
        return saved;
      } catch (e: unknown) {
        if (this.isOrderCodeUniqueViolation(e) && attempt < 4) continue;
        if (this.isClientOrderDuplicateViolation(e)) {
          const dup = await this.orderRepo.findOne({
            where: {
              tradingAccountId: account.id,
              clientOrderId: dto.clientOrderId,
            },
          });
          if (dup) return dup;
        }
        throw e;
      }
    }
    throw new InternalServerErrorException(
      'Không thể tạo mã lệnh duy nhất, vui lòng thử lại',
    );
  }

  async getUserOrders(
    userId: string,
    tradingAccountId: string,
    opts?: {
      from?: string;
      to?: string;
      limitRaw?: string;
      offsetRaw?: string;
      status?: string;
      symbol?: string;
    },
  ) {
    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    const limit = Math.min(
      200,
      Math.max(1, opts?.limitRaw ? parseInt(opts.limitRaw, 10) || 30 : 30),
    );
    const offset = Math.max(
      0,
      opts?.offsetRaw ? parseInt(opts.offsetRaw, 10) || 0 : 0,
    );

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.stock', 'stock')
      .leftJoinAndSelect('o.tradingAccount', 'tradingAccount')
      .where('o.tradingAccountId = :aid', { aid: account.id })
      .orderBy('o.createdAt', 'DESC');

    const range = vnDateRangeToUtcBounds(opts?.from, opts?.to);
    if (range.start) {
      qb.andWhere('o.createdAt >= :start', { start: range.start });
    }
    if (range.end) {
      qb.andWhere('o.createdAt <= :end', { end: range.end });
    }

    const statusKey = opts?.status?.trim();
    if (statusKey === 'active') {
      qb.andWhere('o.status IN (:...active)', {
        active: ['pending', 'partial'],
      });
    } else if (statusKey === 'filled') {
      qb.andWhere('o.status = :filled', { filled: 'filled' });
    } else if (statusKey === 'cancelled') {
      qb.andWhere('o.status IN (:...cancelled)', {
        cancelled: ['cancelled', 'partial_cancelled', 'rejected'],
      });
    }

    const sym = opts?.symbol?.trim().toUpperCase();
    if (sym) {
      qb.andWhere('UPPER(stock.symbol) LIKE :sym', { sym: `%${sym}%` });
    }

    const [orders, total] = await qb
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    if (orders.length === 0) {
      return { accountId: account.accountId, items: [], total, limit, offset };
    }

    const avgMap = await this.avgMatchedPriceByOrderIds(
      orders.map((o) => o.id),
    );
    return {
      accountId: account.accountId,
      items: orders.map((o) => ({
        ...o,
        avgMatchedPrice: avgMap.get(o.id) ?? null,
      })),
      total,
      limit,
      offset,
    };
  }

  /** Giá khớp TB = Σ(price×qty) / Σ(qty) từ mọi trade của lệnh (mua hoặc bán). */
  private async avgMatchedPriceByOrderIds(
    orderIds: string[],
  ): Promise<Map<string, number>> {
    if (orderIds.length === 0) return new Map();
    const rows: { order_id: string; avg_price: string | null }[] =
      await this.tradeRepo.query(
        `SELECT order_id,
                CASE WHEN SUM(qty) > 0 THEN SUM(val) / SUM(qty) ELSE NULL END AS avg_price
         FROM (
           SELECT buy_order_id AS order_id,
                  (price * quantity) AS val,
                  quantity AS qty
           FROM trades
           WHERE buy_order_id = ANY($1::uuid[])
           UNION ALL
           SELECT sell_order_id,
                  (price * quantity),
                  quantity
           FROM trades
           WHERE sell_order_id = ANY($1::uuid[])
         ) t
         GROUP BY order_id`,
        [orderIds],
      );
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.avg_price == null) continue;
      const v = Number(r.avg_price);
      if (Number.isFinite(v) && v > 0) {
        map.set(r.order_id, Math.round(v * 100) / 100);
      }
    }
    return map;
  }

  async cancelOrder(
    userId: string,
    orderId: string,
    tradingAccountId: string,
  ) {
    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      tradingAccountId,
    );
    const saved = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: {
          id: orderId,
          tradingAccountId: account.id,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        this.throwBusinessError('ORDER_NOT_CANCELLABLE');
      }
      // Không đồng thời `relations.stock` + `FOR UPDATE`: Postgres không cho lock kèm LEFT JOIN.
      const stock = await manager.findOne(Stock, {
        where: { id: order.stockId },
      });
      if (!stock) {
        this.throwBusinessError('ORDER_NOT_CANCELLABLE');
      }
      if (order.orderType === OrderType.MAK) {
        this.throwBusinessError('ORDER_NOT_CANCELLABLE');
      }
      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.PARTIAL
      ) {
        this.throwBusinessError('ORDER_NOT_CANCELLABLE');
      }
      const remainingQty = Number(order.quantity) - Number(order.matchedQty);
      if (remainingQty <= 0) {
        this.throwBusinessError('ORDER_NOT_CANCELLABLE');
      }

      if (order.side === OrderSide.BUY) {
        const wallet = await manager.findOne(Wallet, {
          where: { tradingAccountId: account.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!wallet) {
          this.throwBusinessError('WALLET_NOT_FOUND', undefined, 404);
        }
        const lockedAmount = Number(order.price ?? 0) * remainingQty;
        wallet.availableBalance =
          Number(wallet.availableBalance) + Number(lockedAmount);
        wallet.lockedBalance = Math.max(
          0,
          Number(wallet.lockedBalance) - Number(lockedAmount),
        );
        await manager.save(wallet);
        await manager.save(
          manager.create(CashTransaction, {
            walletId: wallet.id,
            type: TransactionType.BUY_UNLOCK,
            amount: lockedAmount,
            ...walletLedgerSnapshot(wallet),
            refOrderId: order.id,
            description: `Mở khóa tiền khi hủy lệnh ${order.orderCode ?? order.id}`,
          }),
        );
      } else {
        const position = await manager.findOne(Position, {
          where: { tradingAccountId: account.id, stockId: order.stockId },
          lock: { mode: 'pessimistic_write' },
        });
        if (position) {
          position.quantity = Number(position.quantity) + remainingQty;
          position.lockedQuantity = Math.max(
            0,
            Number(position.lockedQuantity) - remainingQty,
          );
          await manager.save(position);
          await recordPositionLedger(manager, {
            tradingAccountId: account.id,
            stockId: order.stockId,
            type: StockLedgerType.SELL_UNLOCK,
            quantityDelta: remainingQty,
            lockedDelta: -remainingQty,
            quantityAfter: Number(position.quantity),
            lockedAfter: Number(position.lockedQuantity),
            refOrderId: order.id,
            description: `Hủy lệnh bán — hoàn ${remainingQty} CP`,
          });
        }
      }

      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      const out = await manager.save(order);
      out.stock = stock;
      return out;
    });
    const sym = saved.stock.symbol.toUpperCase();
    this.logger.log(
      `[order-flow] cancel order | ${orderRef(saved.id, saved.orderCode)} ${sym}`,
    );
    await this.matching
      .enqueueCancelled(saved.id, saved.stockId, sym, saved.orderCode)
      .catch((e: unknown) =>
        this.logger.error(`[order-flow] enqueue cancel failed: ${String(e)}`),
      );
    return saved;
  }

  private async verifyTradingPin(userId: string, pin: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'tradingPinHash'],
    });
    if (!user?.tradingPinHash) {
      this.throwBusinessError('TRADING_PIN_NOT_SET');
    }
    const valid = await bcrypt.compare(pin, user.tradingPinHash);
    if (!valid) {
      this.throwBusinessError('TRADING_PIN_INVALID');
    }
  }

  private async consumeOrderIntent(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<StoredOrderIntent> {
    const raw = await this.redis.get(orderIntentByTxKey(dto.transactionId));
    if (!raw) {
      this.throwBusinessError('ORDER_INTENT_EXPIRED');
    }

    let intent: StoredOrderIntent;
    try {
      intent = JSON.parse(raw) as StoredOrderIntent;
    } catch {
      this.throwBusinessError('ORDER_INTENT_INVALID');
    }

    if (
      intent.userId !== userId ||
      intent.tradingAccountId !== dto.tradingAccountId ||
      intent.tokenId !== dto.tokenId ||
      intent.requestId !== dto.requestId
    ) {
      this.throwBusinessError('ORDER_INTENT_INVALID');
    }

    const isLo = dto.orderType === OrderType.LO;
    const priceOk =
      !isLo || (dto.price != null && Number(dto.price) === intent.orderPrice);
    if (
      intent.stockId !== dto.stockId ||
      intent.side !== dto.side ||
      intent.orderType !== dto.orderType ||
      intent.quantity !== dto.quantity ||
      !priceOk
    ) {
      this.throwBusinessError('ORDER_INTENT_MISMATCH');
    }

    await this.redis.del(orderIntentByTxKey(dto.transactionId));
    await this.redis.del(orderIntentByTokenKey(dto.tokenId));
    return intent;
  }

  private async resolveOrderDraft(userId: string, dto: PreCheckOrderDto) {
    const isLo = dto.orderType === OrderType.LO;
    const isMak = isMakOrderType(dto.orderType);
    if (!isLo && !isMak) {
      this.throwBusinessError('ORDER_TYPE_NOT_SUPPORTED', {
        orderType: dto.orderType,
      });
    }
    if (dto.quantity % 100 !== 0) {
      this.throwBusinessError('INVALID_QUANTITY_LOT');
    }
    if (isLo && (!dto.price || dto.price <= 0)) {
      this.throwBusinessError('INVALID_PRICE');
    }

    const account = await resolveTradingAccountForUser(
      this.accountRepo,
      userId,
      dto.tradingAccountId,
    );
    const stock = await this.stockRepo.findOne({ where: { id: dto.stockId } });
    if (!stock) {
      this.throwBusinessError('STOCK_NOT_FOUND');
    }

    const snap = await this.snapshotRepo.findOne({
      where: { stockId: stock.id },
      order: { tradingDate: 'DESC', updatedAt: 'DESC' },
    });
    if (!snap) {
      this.throwBusinessError('MISSING_REFERENCE_PRICE');
    }
    const floor = Number(snap.floorPrice);
    const ceiling = Number(snap.ceilingPrice);

    const orderPrice = isMak
      ? resolveMakLimitPrice(dto.side, floor, ceiling)
      : Number(dto.price);
    await this.checkAmplitude(stock.id, orderPrice);

    const estimatedTotal = Number(orderPrice) * Number(dto.quantity);
    let availableBalance: number | null = null;
    let sellableQuantity: number | null = null;

    if (dto.side === OrderSide.BUY) {
      const wallet = await this.walletRepo.findOne({
        where: { tradingAccountId: account.id },
      });
      if (!wallet) {
        this.throwBusinessError('WALLET_NOT_FOUND', undefined, 404);
      }
      const available = Number(wallet.availableBalance);
      availableBalance = available;
      if (available < estimatedTotal) {
        this.throwBusinessError('INSUFFICIENT_BALANCE');
      }
    } else {
      const position = await this.positionRepo.findOne({
        where: { tradingAccountId: account.id, stockId: dto.stockId },
      });
      const availableQty = position ? Number(position.quantity) : 0;
      sellableQuantity = availableQty;
      if (availableQty < Number(dto.quantity)) {
        this.throwBusinessError('INSUFFICIENT_SELLABLE_QTY');
      }
    }

    return {
      account,
      stock,
      symbol: stock.symbol.toUpperCase(),
      orderPrice,
      floor,
      ceiling,
      estimatedTotal,
      availableBalance,
      sellableQuantity,
    };
  }

  private async checkAmplitude(stockId: string, price: number) {
    const latestSnapshot = await this.snapshotRepo.findOne({
      where: { stockId },
      order: { tradingDate: 'DESC', updatedAt: 'DESC' },
    });
    if (!latestSnapshot) {
      this.throwBusinessError('MISSING_REFERENCE_PRICE');
    }

    const floor = Number(latestSnapshot.floorPrice);
    const ceiling = Number(latestSnapshot.ceilingPrice);
    if (price > ceiling || price < floor) {
      this.throwBusinessError('PRICE_OUT_OF_BAND', {
        floor: floor.toFixed(0),
        ceiling: ceiling.toFixed(0),
      });
    }
  }

  private throwBusinessError(
    errorKey: AppErrorKey,
    errorParams?: Record<string, string | number | undefined>,
    httpStatus = 400,
  ): never {
    this.logger.warn(`[${errorKey}]`);
    throw new BusinessException(errorKey, errorParams, httpStatus);
  }

  private buildOrderCode(now = new Date()): string {
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const random2 = Math.floor(Math.random() * 36 ** 2)
      .toString(36)
      .toUpperCase()
      .padStart(2, '0');
    return `OD${dd}${mm}${yy}${hh}${mi}${ss}${random2}`;
  }

  private isOrderCodeUniqueViolation(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const d = err.driverError as { code?: string; detail?: string } | undefined;
    return (
      d?.code === '23505' && String(d?.detail ?? '').includes('order_code')
    );
  }

  private isClientOrderDuplicateViolation(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const d = err.driverError as { code?: string; detail?: string } | undefined;
    return (
      d?.code === '23505' && String(d?.detail ?? '').includes('client_order_id')
    );
  }
}
