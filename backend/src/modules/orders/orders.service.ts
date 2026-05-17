import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import {
  OrderType,
  OrderStatus,
  OrderSide,
  TransactionType,
} from '../../common/const';
import { Stock } from '../../database/entities/stock.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { MatchingService } from '../matching/matching.service';
import { BusinessException } from '../../common/errors/business.exception';
import type { AppErrorKey } from '../../common/errors/error-const';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
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
    if (dto.orderType !== OrderType.LO) {
      this.throwBusinessError('ORDER_TYPE_NOT_SUPPORTED');
    }
    if (dto.quantity % 100 !== 0) {
      this.throwBusinessError('INVALID_QUANTITY_LOT');
    }
    if (!dto.price || dto.price <= 0) {
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
    await this.checkAmplitude(stock.id, dto.price);

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
            const estimatedCost = Number(dto.price) * Number(dto.quantity);
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
              price: dto.price,
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
                description: `Khóa tiền cho lệnh ${persisted.orderCode ?? persisted.id}`,
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
            price: dto.price,
            quantity: dto.quantity,
          });
          return manager.save(order);
        });
        void this.matching
          .enqueueAccepted(saved.id, saved.stockId)
          .catch((e: unknown) =>
            this.logger.error(`enqueueAccepted: ${String(e)}`),
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
    return this.orderRepo.find({
      where: { tradingAccountId: account.id },
      relations: { stock: true, tradingAccount: true },
      order: { createdAt: 'DESC' },
    });
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
    void this.matching
      .enqueueCancelled(saved.id, saved.stockId, saved.stock.symbol)
      .catch((e: unknown) =>
        this.logger.error(`enqueueCancelled: ${String(e)}`),
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
