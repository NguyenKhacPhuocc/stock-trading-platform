import { EventEmitter } from 'events';
import { Injectable } from '@nestjs/common';
import type { SymbolBook } from './symbol-book';

export type BookUpdatedPayload = {
  symbol: string;
  stockId: string;
  book: SymbolBook;
  lastTradePrice: number | null;
  lastMatchedQty: number;
  fillsCount: number;
};

export type BookCancelledPayload = {
  symbol: string;
  stockId: string;
  book: SymbolBook;
};

/**
 * Internal event bus để tách matching engine khỏi market data publisher.
 * Engine emit event → MarketDataService subscribe và xử lý async.
 *
 * Dùng Node EventEmitter (sync dispatch) — handler là fire-and-forget async.
 * Phù hợp với monolith; nếu cần scale thì thay bằng Redis pub/sub.
 */
@Injectable()
export class MatchingEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Tăng limit để tránh warning nếu có nhiều subscriber
    this.emitter.setMaxListeners(20);
  }

  emitBookUpdated(payload: BookUpdatedPayload): void {
    this.emitter.emit('book:updated', payload);
  }

  emitBookCancelled(payload: BookCancelledPayload): void {
    this.emitter.emit('book:cancelled', payload);
  }

  onBookUpdated(handler: (p: BookUpdatedPayload) => Promise<void>): void {
    this.emitter.on('book:updated', (p: BookUpdatedPayload) => {
      void handler(p).catch((e: unknown) =>
        console.error('[EventBus] book:updated error', e),
      );
    });
  }

  onBookCancelled(handler: (p: BookCancelledPayload) => Promise<void>): void {
    this.emitter.on('book:cancelled', (p: BookCancelledPayload) => {
      void handler(p).catch((e: unknown) =>
        console.error('[EventBus] book:cancelled error', e),
      );
    });
  }
}
