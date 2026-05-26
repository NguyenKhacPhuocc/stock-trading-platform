import { EventEmitter } from 'events';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import {
  NotificationType,
  OrderSide,
  OrderStatus,
  OrderType,
  TransactionType,
} from '../../common/const';
import { NotificationsService } from '../notifications/notifications.service';
import { isMakOrderType } from '../orders/util/mak-order.util';
import type { OrderFillNotify } from './dto/order-fill-notify.dto';
import type {
  OrderMatchedNotificationWs,
  OrderMatchedWsPayload,
} from './dto/order-matched-ws.dto';
import type { Notification } from '../../database/entities/notification.entity';
import { MarketService } from '../market/market.service';
import type { QueuedOrder } from './dto/matching.dto';
import type {
  BookUpdatedPayload,
  BookCancelledPayload,
} from './dto/book-events.dto';
import { BookRegistry } from './book-registry.service';
import { TradeFillService } from './trade-fill.service';
import { OrderbookWalService } from './orderbook-wal.service';
import { OrderbookWsService } from './orderbook-ws.service';
import { AppGateway } from '../../websocket/app.gateway';
import { bookOrdersLine, orderRef } from './util/order-flow-log.util';
import { walletLedgerSnapshot } from '../../common/utils/wallet-ledger-snapshot.util';

/**
 * Khớp lệnh: BullMQ → SymbolBook (RAM) → TradeFillService (DB) → WAL/Redis/WS.
 * Luồng đầy đủ: DO-AN-SAN-CHUNG-KHOAN-TECH-SPEC.md §6.3.1
 */
@Injectable()
export class MatchingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchingService.name);
  private readonly eventEmitter = new EventEmitter();
  private readonly tails = new Map<string, Promise<void>>();
  private readonly tradeSeqCounters = new Map<string, number>();

  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly books: BookRegistry,
    private readonly tradeFill: TradeFillService,
    private readonly wal: OrderbookWalService,
    private readonly orderbookWs: OrderbookWsService,
    private readonly market: MarketService,
    @Inject(forwardRef(() => AppGateway))
    private readonly gateway: AppGateway,
    private readonly notifications: NotificationsService,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Trade) private readonly tradeRepo: Repository<Trade>,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.setMaxListeners(20);
    this.setupEventHandlers();
    this.initBullMq();
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async enqueueAccepted(
    orderId: string,
    stockId: string,
    orderCode?: string | null,
    symbol?: string,
  ): Promise<void> {
    const ref = orderRef(orderId, orderCode);
    const job = await this.queue!.add(
      'accepted',
      { orderId, stockId },
      {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
    );
    this.logger.log(
      `[order-flow] added to queue accepted | order ${ref}${symbol ? ` ${symbol.toUpperCase()}` : ''} jobId=${job.id}`,
    );
  }

  async enqueueCancelled(
    orderId: string,
    stockId: string,
    symbol: string,
    orderCode?: string | null,
  ): Promise<void> {
    const ref = orderRef(orderId, orderCode);
    const job = await this.queue!.add(
      'cancelled',
      { orderId, stockId, symbol },
      {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
    );
    this.logger.log(
      `[order-flow] added to queue cancelled | order ${ref} ${symbol.toUpperCase()} jobId=${job.id}`,
    );
  }

  publishSubscribeOrderbookBySymbol(rawSymbol: string): Promise<void> {
    return this.orderbookWs.publishSubscribeBySymbol(rawSymbol);
  }

  private setupEventHandlers(): void {
    this.eventEmitter.on('book:updated', this.handleBookUpdatedEvent);
    this.eventEmitter.on('book:cancelled', this.handleBookCancelledEvent);
  }

  private readonly handleBookUpdatedEvent = (p: BookUpdatedPayload): void => {
    void this.onBookUpdated(p).catch((e: unknown) =>
      this.logger.error(`book:updated: ${String(e)}`),
    );
  };

  private readonly handleBookCancelledEvent = (
    p: BookCancelledPayload,
  ): void => {
    void this.onBookCancelled(p).catch((e: unknown) =>
      this.logger.error(`book:cancelled: ${String(e)}`),
    );
  };

  private async onBookUpdated(p: BookUpdatedPayload): Promise<void> {
    this.logger.log(
      `[order-flow] book:updated ${p.symbol.toUpperCase()} | fills=${p.fillsCount} ${bookOrdersLine(p.book)}`,
    );
    await this.orderbookWs.emitBookUpdate(p.symbol, p.book, p.stockId);
    this.orderbookWs.emitBoardDepthFromBook(p.symbol, p.stockId, p.book);
    this.scheduleBoardSnapshotPersist(p.stockId, p.fillsCount > 0);
  }

  private async onBookCancelled(p: BookCancelledPayload): Promise<void> {
    this.logger.log(
      `[order-flow] book:cancelled ${p.symbol.toUpperCase()} | ${bookOrdersLine(p.book)}`,
    );
    await this.orderbookWs.emitBookUpdate(p.symbol, p.book, p.stockId);
    this.orderbookWs.emitBoardDepthFromBook(p.symbol, p.stockId, p.book);
    this.scheduleBoardSnapshotPersist(p.stockId, false);
  }

  /** Ghi snapshot DB nền — không rebuild cache symbols (tránh ~1s chặn hot path). */
  private scheduleBoardSnapshotPersist(
    stockId: string,
    emitBoardAfterPersist: boolean,
  ): void {
    void (async () => {
      try {
        const board = await this.market.refreshBoardForStock(stockId, {
          rebuildSymbolsCache: false,
        });
        if (!board || !emitBoardAfterPersist) return;
        this.orderbookWs.emitPriceBoardFromSnapshot(
          board.symbol,
          board.stockId,
          board.snap,
          false,
        );
      } catch (e: unknown) {
        this.logger.warn(
          `[order-flow] refreshBoardForStock (background): ${String(e)}`,
        );
      }
    })();
  }

  private initBullMq(): void {
    const connection = new IORedis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      db: this.config.get<number>('REDIS_DATABASE', 0),
      maxRetriesPerRequest: null,
    });
    this.connection = connection;

    const queueName = this.config.get<string>(
      'MATCHING_QUEUE_NAME',
      'matching-jobs',
    );
    this.queue = new Queue(queueName, { connection });

    this.worker = new Worker(
      queueName,
      async (job) => {
        if (job.name === 'accepted') {
          const { orderId, stockId } = job.data as {
            orderId: string;
            stockId: string;
          };
          await this.runAcceptedChain(orderId, stockId);
        } else if (job.name === 'cancelled') {
          const { orderId, stockId, symbol } = job.data as {
            orderId: string;
            stockId: string;
            symbol: string;
          };
          await this.runCancelledChain(orderId, stockId, symbol);
        }
      },
      {
        connection,
        concurrency: this.config.get<number>('MATCHING_QUEUE_CONCURRENCY', 8),
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`job ${job?.id} failed: ${String(err)}`);
    });
    this.logger.log(`BullMQ "${queueName}" started`);
  }

  private runAcceptedChain(orderId: string, stockId: string): Promise<void> {
    const prev = this.tails.get(stockId) ?? Promise.resolve();
    const job = prev
      .then(() => this.runAccepted(orderId, stockId))
      .catch((e: unknown) => {
        this.logger.error(`accepted ${orderId}: ${String(e)}`);
      });
    this.tails.set(stockId, job);
    return job;
  }

  private runCancelledChain(
    orderId: string,
    stockId: string,
    symbol: string,
  ): Promise<void> {
    const prev = this.tails.get(stockId) ?? Promise.resolve();
    const job = prev
      .then(() => this.runCancelled(orderId, stockId, symbol))
      .catch((e: unknown) => {
        this.logger.error(`cancelled ${orderId}: ${String(e)}`);
      });
    this.tails.set(stockId, job);
    return job;
  }

  private async runAccepted(orderId: string, stockId: string): Promise<void> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: { stock: true },
    });
    const ref = orderRef(orderId, order?.orderCode);
    if (!order?.stock) {
      this.logger.warn(`[order-flow] skip matching | order ${ref} not found`);
      return;
    }
    const sym = order.stock.symbol.toUpperCase();
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REJECTED ||
      order.status === OrderStatus.FILLED ||
      order.status === OrderStatus.PARTIAL_CANCELLED
    ) {
      this.logger.log(
        `[order-flow] skip matching | order ${ref} status=${order.status}`,
      );
      return;
    }

    const remaining = Number(order.quantity) - Number(order.matchedQty);
    if (remaining <= 0) {
      this.logger.log(
        `[order-flow] skip matching | order ${ref} no remaining qty`,
      );
      return;
    }

    this.logger.log(
      `[order-flow] worker start matching | order ${ref} ${order.side.toUpperCase()} ${remaining} ${sym} @ ${order.price}`,
    );

    const queued: QueuedOrder = {
      orderId: order.id,
      tradingAccountId: order.tradingAccountId,
      stockId: order.stockId,
      side: order.side,
      price: Number(order.price ?? 0),
      remainingQty: remaining,
      createdAtMs: order.createdAt.getTime(),
    };

    const book = this.books.getBook(stockId);
    await this.orderbookWs.ensureBookReady(sym, stockId, book, order.id);
    this.logger.log(
      `[order-flow] book before match ${sym} | ${bookOrdersLine(book)}`,
    );
    const snap = book.snapshot();

    try {
      const { fills, remainder, removedOrderIds } = book.matchIncoming(queued);

      if (fills.length === 0) {
        this.logger.log(`[order-flow] no match in book | order ${ref}`);
      }
      for (const fill of fills) {
        this.logger.log(
          `[order-flow] matched | buy ${orderRef(fill.buyOrderId)} x sell ${orderRef(fill.sellOrderId)} qty=${fill.quantity} @ ${fill.price}`,
        );
      }

      for (const oid of removedOrderIds) {
        this.logger.log(
          `[order-flow] order removed from book RAM | ${orderRef(oid)}`,
        );
        await this.wal.appendRemove(sym, stockId, oid);
      }

      let lastPx: number | null = null;
      let lastMq = 0;

      if (fills.length > 0) {
        this.logger.log(
          `[order-flow] persist fills DB | ${fills.length} trade(s)`,
        );
        const fillResult = await this.tradeFill.applyFills(fills, sym);
        lastPx = fillResult.lastTradePrice;
        lastMq = fills[fills.length - 1]?.quantity ?? 0;
        await this.emitOrderMatchedNotifies(fillResult.notifies);
        this.emitTradeTicks(stockId, fills);
      }

      const isMak = order.orderType === OrderType.MAK;

      if (remainder && remainder.remainingQty > 0) {
        if (isMak) {
          this.logger.log(
            `[order-flow] MAK kill remainder | ${orderRef(remainder.orderId)} qty=${remainder.remainingQty}`,
          );
          const makNotify = await this.killMakRemainder(order.id, sym);
          if (makNotify) {
            await this.emitOrderMatchedNotifies([makNotify]);
          }
        } else {
          this.logger.log(
            `[order-flow] order rest on book | ${orderRef(remainder.orderId)} qty=${remainder.remainingQty} @ ${remainder.price}`,
          );
          book.removeOrder(remainder.orderId);
          book.rest(remainder);
          await this.wal.appendRest(sym, stockId, remainder);
        }
      }

      if (fills.length > 0 || isMak) {
        await this.orderbookWs.syncBookFromDb(sym, stockId, book);
      }

      this.eventEmitter.emit('book:updated', {
        symbol: sym,
        stockId,
        book,
        lastTradePrice: fills.length > 0 ? lastPx : null,
        lastMatchedQty: fills.length > 0 ? lastMq : 0,
        fillsCount: fills.length,
      } satisfies BookUpdatedPayload);
    } catch (e: unknown) {
      this.logger.error(
        `[order-flow] matching failed | order ${ref}: ${String(e)}`,
      );
      book.restore(snap);
      throw e;
    }
  }

  private async runCancelled(
    orderId: string,
    stockId: string,
    symbol: string,
  ): Promise<void> {
    const sym = symbol.toUpperCase();
    const ref = orderRef(orderId);
    this.logger.log(`[order-flow] worker start cancel | order ${ref} ${sym}`);
    const book = this.books.getBook(stockId);
    const removed = book.removeOrder(orderId);
    if (removed) {
      this.logger.log(`[order-flow] order removed from book RAM | ${ref}`);
      await this.wal.appendRemove(sym, stockId, orderId);
    } else {
      this.logger.log(`[order-flow] order not on book RAM | ${ref}`);
    }
    if (!removed) {
      await this.orderbookWs.syncBookFromDb(sym, stockId, book);
    }
    this.eventEmitter.emit('book:cancelled', {
      symbol: sym,
      stockId,
      book,
    } satisfies BookCancelledPayload);
  }

  /** MAK: hủy phần còn lại, mở khóa tài sản — không treo sổ. */
  private async killMakRemainder(
    orderId: string,
    symbol: string,
  ): Promise<OrderFillNotify | null> {
    return this.orderRepo.manager.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order || !isMakOrderType(order.orderType)) return null;

      const remainingQty = Number(order.quantity) - Number(order.matchedQty);
      if (remainingQty <= 0) return null;

      if (order.side === OrderSide.BUY) {
        const wallet = await manager.findOne(Wallet, {
          where: { tradingAccountId: order.tradingAccountId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!wallet) throw new Error('WALLET_NOT_FOUND');
        const lockedAmount = Number(order.price ?? 0) * remainingQty;
        wallet.availableBalance =
          Number(wallet.availableBalance) + lockedAmount;
        wallet.lockedBalance = Math.max(
          0,
          Number(wallet.lockedBalance) - lockedAmount,
        );
        await manager.save(wallet);
        await manager.save(
          manager.create(CashTransaction, {
            walletId: wallet.id,
            type: TransactionType.BUY_UNLOCK,
            amount: lockedAmount,
            ...walletLedgerSnapshot(wallet),
            refOrderId: order.id,
            description: `MAK hủy phần dư ${remainingQty} ${symbol}`,
          }),
        );
      } else {
        const position = await manager.findOne(Position, {
          where: {
            tradingAccountId: order.tradingAccountId,
            stockId: order.stockId,
          },
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

      const matchedQty = Number(order.matchedQty);
      if (matchedQty <= 0) {
        order.status = OrderStatus.CANCELLED;
        order.cancelledAt = new Date();
      } else {
        order.status = OrderStatus.PARTIAL_CANCELLED;
        order.cancelledAt = new Date();
      }
      await manager.save(order);

      const account = await manager.findOne(TradingAccount, {
        where: { id: order.tradingAccountId },
      });
      if (!account) return null;

      this.logger.log(
        `[order-flow] MAK remainder killed DB | ${orderRef(order.id, order.orderCode)} status=${order.status} matched=${order.matchedQty}/${order.quantity}`,
      );

      return {
        orderId: order.id,
        userId: account.userId,
        status: order.status,
        matchedQty: Number(order.matchedQty),
        quantity: Number(order.quantity),
        side: order.side,
        symbol: symbol.trim().toUpperCase(),
        fillPrice: 0,
        fillQty: 0,
      };
    });
  }

  private async emitOrderMatchedNotifies(
    notifies: OrderFillNotify[],
  ): Promise<void> {
    for (const n of notifies) {
      const saved = await this.persistOrderMatchedNotification(n);
      if (!saved) continue;

      const payload: OrderMatchedWsPayload = {
        ...n,
        notification: this.toNotificationWs(saved),
      };
      this.logger.log(
        `[order-flow] emit WS order:matched | orderId=${n.orderId} userId=${n.userId.slice(0, 8)} notifId=${saved.id.slice(0, 8)} matched=${n.matchedQty}/${n.quantity}`,
      );
      this.gateway.emitOrderMatched(n.userId, payload);
    }
  }

  private toNotificationWs(row: Notification): OrderMatchedNotificationWs {
    return {
      id: row.id,
      type: String(row.type),
      title: row.title,
      content: row.content,
      isRead: row.isRead,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
    };
  }

  private async persistOrderMatchedNotification(
    n: OrderFillNotify,
  ): Promise<Notification | null> {
    try {
      const sideLabel = n.side === OrderSide.SELL ? 'Bán' : 'Mua';
      const title = `Khớp lệnh ${n.symbol} (${sideLabel})`;
      const statusLabel = String(n.status);
      const fillQty = Number(n.fillQty);
      const fillPrice = Number(n.fillPrice);
      const matchedQty = Number(n.matchedQty);
      const quantity = Number(n.quantity);
      const content =
        fillQty > 0
          ? `Khớp ${fillQty.toLocaleString('vi-VN')} CP @ ${fillPrice.toLocaleString('vi-VN')} — Tổng ${matchedQty.toLocaleString('vi-VN')}/${quantity.toLocaleString('vi-VN')} (${statusLabel})`
          : `Cập nhật lệnh — Tổng khớp ${matchedQty.toLocaleString('vi-VN')}/${quantity.toLocaleString('vi-VN')} (${statusLabel})`;
      return await this.notifications.create(
        n.userId,
        NotificationType.ORDER_MATCHED,
        title,
        content,
      );
    } catch (e) {
      this.logger.warn(
        `[order-flow] notification persist failed | orderId=${n.orderId} ${String(e)}`,
      );
      return null;
    }
  }

  private emitTradeTicks(
    stockId: string,
    fills: Array<{ quantity: number; price: number }>,
  ): void {
    if (fills.length === 0) return;

    for (const fill of fills) {
      const seq = (this.tradeSeqCounters.get(stockId) ?? 0) + 1;
      this.tradeSeqCounters.set(stockId, seq);

      const compactPayload = {
        px: fill.price,
        qty: fill.quantity,
        ts: new Date().toISOString(),
      };

      this.logger.log(
        `[order-flow] emit WS ot | stockId=${stockId.slice(0, 8)} seq=${seq} px=${fill.price} qty=${fill.quantity}`,
      );
      this.gateway.emitTradeTick({
        stockId,
        type: 'ot',
        seq,
        data: compactPayload,
      });
    }
  }
}
