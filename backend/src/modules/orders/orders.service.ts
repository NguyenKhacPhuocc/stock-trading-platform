import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { OrderType, OrderStatus, OrderSide, TransactionType } from '../../common/const';
import { Stock } from '../../database/entities/stock.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { MatchingService } from '../matching/matching.service';
import { formatCreateOrder, orderRef } from '../matching/util/order-flow-log.util';
import { BusinessException } from '../../common/errors/business.exception';
import type { AppErrorKey } from '../../common/errors/error-const';
import { isMakOrderType, resolveMakLimitPrice } from './util/mak-order.util';

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
    private readonly matching: MatchingService,
    private dataSource: DataSource,
  ) {}

  private async getDefaultAccount(userId: string): Promise<TradingAccount> {
    const account = await this.accountRepo.findOne({
      where: { userId, isDefault: true },
    });
    if (!account) {
      this.throwBusinessError('TRADING_ACCOUNT_NOT_FOUND', undefined, 404);
    }
    return account;
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    const isLo = dto.orderType === OrderType.LO;
    const isMak = isMakOrderType(dto.orderType);
    if (!isLo && !isMak) {
      this.throwBusinessError('ORDER_TYPE_NOT_SUPPORTED');
    }
    if (dto.quantity % 100 !== 0) {
      this.throwBusinessError('INVALID_QUANTITY_LOT');
    }
    if (isLo && (!dto.price || dto.price <= 0)) {
      this.throwBusinessError('INVALID_PRICE');
    }

    const account = await this.getDefaultAccount(userId);
    const existing = await this.orderRepo.findOne({
      where: { tradingAccountId: account.id, clientOrderId: dto.clientOrderId },
    });
    if (existing) return existing;

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

    const sym = stock.symbol.toUpperCase();
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
            const estimatedCost = Number(orderPrice) * Number(dto.quantity);
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
                balanceAfter:
                  Number(wallet.availableBalance) +
                  Number(wallet.lockedBalance),
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
          if (position) {
            position.quantity = availableQty - Number(dto.quantity);
            position.lockedQuantity =
              Number(position.lockedQuantity) + Number(dto.quantity);
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
          return manager.save(order);
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

  async getUserOrders(userId: string) {
    const account = await this.getDefaultAccount(userId);
    const orders = await this.orderRepo.find({
      where: { tradingAccountId: account.id },
      relations: { stock: true, tradingAccount: true },
      order: { createdAt: 'DESC' },
    });
    if (orders.length === 0) return [];
    const avgMap = await this.avgMatchedPriceByOrderIds(
      orders.map((o) => o.id),
    );
    return orders.map((o) => ({
      ...o,
      avgMatchedPrice: avgMap.get(o.id) ?? null,
    }));
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

  async cancelOrder(userId: string, orderId: string) {
    const account = await this.getDefaultAccount(userId);
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
            balanceAfter:
              Number(wallet.availableBalance) + Number(wallet.lockedBalance),
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
