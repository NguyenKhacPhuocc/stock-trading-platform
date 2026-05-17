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
import { OrderStatus } from '../../common/const';
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
import type { OrderFillNotify } from './dto/order-fill-notify.dto';

/**
 * Điều phối khớp lệnh: hàng đợi BullMQ, sổ in-memory, WAL, WS.
 * Chi tiết ghi DB / Redis / socket nằm ở các service tên theo việc làm.
 */
@Injectable()
export class MatchingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchingService.name);
  private readonly eventEmitter = new EventEmitter();
  private readonly tails = new Map<string, Promise<void>>();

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
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
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

  async enqueueAccepted(orderId: string, stockId: string): Promise<void> {
    await this.queue!.add(
      'accepted',
      { orderId, stockId },
      {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
    );
  }

  async enqueueCancelled(
    orderId: string,
    stockId: string,
    symbol: string,
  ): Promise<void> {
    await this.queue!.add(
      'cancelled',
      { orderId, stockId, symbol },
      {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
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
    await this.market
      .refreshBoardForStock(p.stockId)
      .catch((e: unknown) =>
        this.logger.warn(`refreshBoardForStock: ${String(e)}`),
      );
    await this.orderbookWs.emitBookUpdate(p.symbol, p.book, p.stockId);

    if (p.fillsCount > 0 && p.lastTradePrice != null && p.lastMatchedQty > 0) {
      this.orderbookWs.emitTradeTick(
        p.symbol,
        p.stockId,
        p.lastTradePrice,
        p.lastMatchedQty,
      );
    }
  }

  private async onBookCancelled(p: BookCancelledPayload): Promise<void> {
    await this.market
      .refreshBoardForStock(p.stockId)
      .catch((e: unknown) =>
        this.logger.warn(`refreshBoardForStock: ${String(e)}`),
      );
    await this.orderbookWs.emitBookUpdate(p.symbol, p.book, p.stockId);
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
    if (!order?.stock) return;
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REJECTED ||
      order.status === OrderStatus.FILLED
    ) {
      return;
    }

    const remaining = Number(order.quantity) - Number(order.matchedQty);
    if (remaining <= 0) return;

    const queued: QueuedOrder = {
      orderId: order.id,
      tradingAccountId: order.tradingAccountId,
      stockId: order.stockId,
      side: order.side,
      price: Number(order.price ?? 0),
      remainingQty: remaining,
      createdAtMs: order.createdAt.getTime(),
    };

    const sym = order.stock.symbol.toUpperCase();
    const book = this.books.getBook(stockId);
    const snap = book.snapshot();

    try {
      const { fills, remainder, removedOrderIds } = book.matchIncoming(queued);

      for (const oid of removedOrderIds) {
        await this.wal.appendRemove(sym, stockId, oid);
      }

      let lastPx: number | null = null;
      let lastMq = 0;

      if (fills.length > 0) {
        const fillResult = await this.tradeFill.applyFills(fills);
        lastPx = fillResult.lastTradePrice;
        lastMq = fills[fills.length - 1]?.quantity ?? 0;
        this.emitOrderMatchedNotifies(fillResult.notifies);
      }

      if (remainder && remainder.remainingQty > 0) {
        book.rest(remainder);
        await this.wal.appendRest(sym, stockId, remainder);
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
    const book = this.books.getBook(stockId);
    const removed = book.removeOrder(orderId);
    if (removed) {
      await this.wal.appendRemove(sym, stockId, orderId);
    }
    this.eventEmitter.emit('book:cancelled', {
      symbol: sym,
      stockId,
      book,
    } satisfies BookCancelledPayload);
  }

  private emitOrderMatchedNotifies(notifies: OrderFillNotify[]): void {
    for (const n of notifies) {
      this.gateway.emitOrderMatched(n.userId, n);
    }
  }
}
