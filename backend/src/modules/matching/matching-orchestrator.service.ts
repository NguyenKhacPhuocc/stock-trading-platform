import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { OrderStatus } from '../../common/const';
import type { QueuedOrder } from './matching-types';
import { MatchingRegistryService } from './matching-registry.service';
import { MatchingPersistenceService } from './matching-persistence.service';
import { MatchingEventBus } from './matching-event-bus.service';
import { OrderbookWalService } from './orderbook-wal.service';

/**
 * Serialize thao tác theo từng mã để tránh race book in-memory.
 * Sau mỗi lệnh: ghi WAL → emit event bus (fire-and-forget).
 * Publisher subscribe event bus độc lập.
 */
@Injectable()
export class MatchingOrchestratorService {
  private readonly logger = new Logger(MatchingOrchestratorService.name);
  private readonly tails = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly registry: MatchingRegistryService,
    private readonly persistence: MatchingPersistenceService,
    private readonly eventBus: MatchingEventBus,
    private readonly wal: OrderbookWalService,
  ) {}

  /** Sau khi API đã persist lệnh — enqueue khớp + resting (gọi từ BullMQ worker). */
  enqueueAccepted(orderId: string, stockId: string): Promise<void> {
    const prev = this.tails.get(stockId) ?? Promise.resolve();
    const job = prev
      .then(() => this.runAccepted(orderId, stockId))
      .catch((e: unknown) => {
        this.logger.error(`matching accepted ${orderId}: ${String(e)}`);
      });
    this.tails.set(stockId, job);
    return job;
  }

  /** Sau khi hủy trong DB — gỡ khỏi book (nếu đang resting). */
  enqueueCancelled(
    orderId: string,
    stockId: string,
    symbol: string,
  ): Promise<void> {
    const prev = this.tails.get(stockId) ?? Promise.resolve();
    const job = prev
      .then(() => this.runCancelled(orderId, stockId, symbol))
      .catch((e: unknown) => {
        this.logger.error(`matching cancel ${orderId}: ${String(e)}`);
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
    const book = this.registry.getBook(stockId);
    const snap = book.snapshot();

    try {
      const { fills, remainder, removedOrderIds } = book.matchIncoming(queued);

      // WAL: log các lệnh resting đã bị khớp hết (trước persist để đúng thứ tự)
      for (const oid of removedOrderIds) {
        await this.wal.appendRemove(sym, stockId, oid);
      }

      let lastPx: number | null = null;
      let lastMq = 0;

      if (fills.length > 0) {
        const r = await this.persistence.applyFills(fills);
        lastPx = r.lastTradePrice;
        lastMq = fills[fills.length - 1]?.quantity ?? 0;
      }

      if (remainder && remainder.remainingQty > 0) {
        book.rest(remainder);
        await this.wal.appendRest(sym, stockId, remainder);
      }

      this.eventBus.emitBookUpdated({
        symbol: sym,
        stockId,
        book,
        lastTradePrice: fills.length > 0 ? lastPx : null,
        lastMatchedQty: fills.length > 0 ? lastMq : 0,
        fillsCount: fills.length,
      });
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
    const book = this.registry.getBook(stockId);
    const removed = book.removeOrder(orderId);
    if (removed) {
      await this.wal.appendRemove(sym, stockId, orderId);
    }
    this.eventBus.emitBookCancelled({ symbol: sym, stockId, book });
  }
}
