import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { SymbolBook } from './util/symbol-book';
import {
  ORDERBOOK_CACHE_MAX_LEVELS,
  orderbookSideRedisKey,
} from './util/matching.constants';
import { aggregatePriceLevels } from './util/book-depth.util';

function priceHashField(price: number): string {
  return String(price);
}

/** Cache depth TOP sổ trên Redis (hash theo mức giá). */
@Injectable()
export class OrderbookRedisService {
  private readonly logger = new Logger(OrderbookRedisService.name);

  constructor(private readonly redis: RedisService) {}

  async syncFromBook(symbolUpper: string, book: SymbolBook): Promise<void> {
    const sym = symbolUpper.trim().toUpperCase();
    const bids = aggregatePriceLevels(
      book.bidLevels,
      ORDERBOOK_CACHE_MAX_LEVELS,
    );
    const asks = aggregatePriceLevels(
      book.askLevels,
      ORDERBOOK_CACHE_MAX_LEVELS,
    );
    try {
      await this.updateHashSide(orderbookSideRedisKey(sym, 'buy'), bids);
      await this.updateHashSide(orderbookSideRedisKey(sym, 'sell'), asks);
    } catch (e: unknown) {
      this.logger.warn(`syncFromBook ${sym}: ${String(e)}`);
    }
  }

  async clearSymbol(symbolUpper: string): Promise<void> {
    const sym = symbolUpper.trim().toUpperCase();
    try {
      await this.redis.del(orderbookSideRedisKey(sym, 'buy'));
      await this.redis.del(orderbookSideRedisKey(sym, 'sell'));
    } catch (e: unknown) {
      this.logger.warn(`clearSymbol ${sym}: ${String(e)}`);
    }
  }

  async readSnapshot(symbolUpper: string): Promise<{
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
      this.logger.warn(`readSnapshot ${sym}: ${String(e)}`);
      return { bids: [], asks: [] };
    }
  }

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
}
