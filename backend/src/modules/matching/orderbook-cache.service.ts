import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { SymbolBook } from './symbol-book';
import { aggregatePriceLevels } from './book-depth.util';
import {
  ORDERBOOK_CACHE_MAX_LEVELS,
  orderbookSideRedisKey,
} from './order-redis.constants';

function priceHashField(price: number): string {
  return String(price);
}

@Injectable()
export class OrderbookCacheService {
  private readonly logger = new Logger(OrderbookCacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Ghi sổ vào Redis: mỗi mức = một cặp field (giá) → value (KL), đúng một dòng UI.
   * Hai key: `orderbook:<SB>:buy` và `orderbook:<SB>:sell`.
   * Cache vô thời hạn; chỉ xóa field khi KL về 0.
   */
  async setMergedLevelsFromBook(
    symbolUpper: string,
    book: SymbolBook,
  ): Promise<void> {
    const sym = symbolUpper.trim().toUpperCase();
    const bids = aggregatePriceLevels(
      book.bidLevels,
      ORDERBOOK_CACHE_MAX_LEVELS,
    );
    const asks = aggregatePriceLevels(
      book.askLevels,
      ORDERBOOK_CACHE_MAX_LEVELS,
    );
    const bidKey = orderbookSideRedisKey(sym, 'buy');
    const askKey = orderbookSideRedisKey(sym, 'sell');
    try {
      await this.updateHashSide(bidKey, bids);
      await this.updateHashSide(askKey, asks);
    } catch (e: unknown) {
      this.logger.warn(`setMergedLevelsFromBook ${sym}: ${String(e)}`);
    }
  }

  /**
   * Cập nhật hash side: chỉ xóa field khi KL = 0, còn lại set/update.
   */
  private async updateHashSide(
    key: string,
    levels: Array<{ price: number; volume: number }>,
  ): Promise<void> {
    const existingHash = await this.redis.hGetAll(key);
    const existingFields = new Set(Object.keys(existingHash));
    const newFields = new Map<string, number>();

    for (const row of levels) {
      newFields.set(priceHashField(row.price), row.volume);
    }

    const toSet: Record<string, number> = {};
    const toDel: string[] = [];

    for (const [field, volume] of newFields.entries()) {
      if (volume > 0) {
        toSet[field] = volume;
      } else {
        toDel.push(field);
      }
    }

    for (const field of existingFields) {
      if (!newFields.has(field)) {
        toDel.push(field);
      }
    }

    if (Object.keys(toSet).length > 0) {
      await this.redis.hSet(key, toSet);
    }
    if (toDel.length > 0) {
      await this.redis.hDel(key, toDel);
    }
  }

  /**
   * Đọc orderbook từ Redis cache — dùng cho snapshot khi client subscribe.
   */
  async getOrderbookSnapshot(symbolUpper: string): Promise<{
    bids: Array<{ price: number; amount: number }>;
    asks: Array<{ price: number; amount: number }>;
  }> {
    const sym = symbolUpper.trim().toUpperCase();
    const bidKey = orderbookSideRedisKey(sym, 'buy');
    const askKey = orderbookSideRedisKey(sym, 'sell');

    try {
      const [bidHash, askHash] = await Promise.all([
        this.redis.hGetAll(bidKey),
        this.redis.hGetAll(askKey),
      ]);

      const bids = Object.entries(bidHash)
        .map(([priceStr, volumeStr]) => ({
          price: Number(priceStr),
          amount: Number(volumeStr),
        }))
        .filter(
          (r) =>
            Number.isFinite(r.price) &&
            Number.isFinite(r.amount) &&
            r.amount > 0,
        )
        .sort((a, b) => b.price - a.price);

      const asks = Object.entries(askHash)
        .map(([priceStr, volumeStr]) => ({
          price: Number(priceStr),
          amount: Number(volumeStr),
        }))
        .filter(
          (r) =>
            Number.isFinite(r.price) &&
            Number.isFinite(r.amount) &&
            r.amount > 0,
        )
        .sort((a, b) => a.price - b.price);

      return { bids, asks };
    } catch (e: unknown) {
      this.logger.warn(`getOrderbookSnapshot ${sym}: ${String(e)}`);
      return { bids: [], asks: [] };
    }
  }
}
