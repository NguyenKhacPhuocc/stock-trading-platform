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
import { MarketService } from '../market/market.service';
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
    private market: MarketService,
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
          const sellableQty = position
            ? Number(position.quantity) - Number(position.lockedQuantity)
            : 0;
          if (sellableQty < Number(dto.quantity)) {
            this.throwBusinessError('INSUFFICIENT_SELLABLE_QTY');
          }
          if (position) {
            position.lockedQuantity =
              Number(position.lockedQuantity) + Number(dto.quantity);
            await manager.save(position);
          }

          const order = manager.create(Order, {
            orderCode,
            tradingAccountId: account.id,
            stockId: dto.stockId,
            side: dto.side,
            orderType: dto.orderType,
            price: dto.price,
            quantity: dto.quantity,
          });
          return manager.save(order);
        });
        void this.market
          .refreshBoardForStock(saved.stockId)
          .catch((e: unknown) => {
            this.logger.warn(`refreshBoardForStock: ${String(e)}`);
          });
        return saved;
      } catch (e: unknown) {
        if (this.isOrderCodeUniqueViolation(e) && attempt < 4) continue;
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
      if (!order || order.status !== OrderStatus.PENDING) {
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
        const lockedAmount = Number(order.price ?? 0) * Number(order.quantity);
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
          position.lockedQuantity = Math.max(
            0,
            Number(position.lockedQuantity) - Number(order.quantity),
          );
          await manager.save(position);
        }
      }

      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      return manager.save(order);
    });
    void this.market.refreshBoardForStock(saved.stockId).catch((e: unknown) => {
      this.logger.warn(`refreshBoardForStock: ${String(e)}`);
    });
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
}
