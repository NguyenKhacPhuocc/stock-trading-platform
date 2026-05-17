import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { QueuedOrder } from './dto/matching.dto';
import { SymbolBook } from './util/symbol-book';
import { BookRegistry } from './book-registry.service';
import {
  WAL_KEY,
  WAL_SNAPSHOT_KEY,
  WAL_MAX_EVENTS,
  WAL_SNAPSHOT_INTERVAL_MS,
  WAL_SNAPSHOT_MAX_AGE_MS,
} from './util/matching.constants';

type WalSnapshot = {
  seq: string;
  ts: number;
  bids: QueuedOrder[];
  asks: QueuedOrder[];
};

/** WAL Redis — phục hồi sổ lệnh khi process restart. */
@Injectable()
export class OrderbookWalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderbookWalService.name);
  private snapshotTimer?: NodeJS.Timeout;
  private readonly symToStockId = new Map<string, string>();
  private readonly lastWalSeq = new Map<string, string>();

  constructor(
    private readonly redis: RedisService,
    private readonly books: BookRegistry,
  ) {}

  onModuleInit(): void {
    this.snapshotTimer = setInterval(() => {
      void this.snapshotAll();
    }, WAL_SNAPSHOT_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
  }

  async appendRest(
    sym: string,
    stockId: string,
    order: QueuedOrder,
  ): Promise<void> {
    this.symToStockId.set(sym, stockId);
    try {
      const seq = await this.redis.xAdd(WAL_KEY(sym), {
        op: 'REST',
        data: JSON.stringify(order),
      });
      this.lastWalSeq.set(sym, seq);
      await this.trimIfNeeded(sym);
    } catch (e: unknown) {
      this.logger.warn(`appendRest ${sym}: ${String(e)}`);
    }
  }

  async appendRemove(
    sym: string,
    stockId: string,
    orderId: string,
  ): Promise<void> {
    this.symToStockId.set(sym, stockId);
    try {
      const seq = await this.redis.xAdd(WAL_KEY(sym), {
        op: 'REMOVE',
        orderId,
      });
      this.lastWalSeq.set(sym, seq);
      await this.trimIfNeeded(sym);
    } catch (e: unknown) {
      this.logger.warn(`appendRemove ${sym}: ${String(e)}`);
    }
  }

  async replayIntoBook(
    sym: string,
    stockId: string,
    book: SymbolBook,
  ): Promise<boolean> {
    const snapStr = await this.redis
      .get(WAL_SNAPSHOT_KEY(sym))
      .catch(() => null);
    if (!snapStr) return false;

    let snap: WalSnapshot;
    try {
      snap = JSON.parse(snapStr) as WalSnapshot;
    } catch {
      return false;
    }

    if (Date.now() - snap.ts > WAL_SNAPSHOT_MAX_AGE_MS) {
      this.logger.warn(
        `${sym}: snapshot quá cũ (${Math.round((Date.now() - snap.ts) / 1000)}s), bỏ qua`,
      );
      return false;
    }

    book.restore({ bids: snap.bids, asks: snap.asks });

    let walEntries: Array<{ id: string; message: Record<string, string> }> = [];
    try {
      walEntries = await this.redis.xRange(WAL_KEY(sym), snap.seq, '+');
    } catch (e: unknown) {
      this.logger.warn(`${sym}: xRange failed: ${String(e)}`);
    }

    let replayed = 0;
    for (const entry of walEntries) {
      if (entry.id === snap.seq) continue;
      const { op, data, orderId } = entry.message;
      if (op === 'REST' && data) {
        try {
          book.rest(JSON.parse(data) as QueuedOrder);
          replayed++;
        } catch {
          /* bỏ qua event lỗi format */
        }
      } else if (op === 'REMOVE' && orderId) {
        book.removeOrder(orderId);
        replayed++;
      }
    }

    this.symToStockId.set(sym, stockId);
    this.logger.log(
      `${sym}: phục hồi snapshot seq=${snap.seq} + replay ${replayed} events`,
    );
    return true;
  }

  private async trimIfNeeded(sym: string): Promise<void> {
    const len = await this.redis.xLen(WAL_KEY(sym));
    if (len > WAL_MAX_EVENTS) {
      await this.redis.xTrim(WAL_KEY(sym), WAL_MAX_EVENTS);
    }
  }

  private async saveSnapshot(sym: string, book: SymbolBook): Promise<void> {
    const seq = this.lastWalSeq.get(sym) ?? '0';
    const bids: QueuedOrder[] = [];
    const asks: QueuedOrder[] = [];
    for (const lvl of book.bidLevels)
      for (const o of lvl.orders) bids.push({ ...o });
    for (const lvl of book.askLevels)
      for (const o of lvl.orders) asks.push({ ...o });

    const snap: WalSnapshot = { seq, ts: Date.now(), bids, asks };
    await this.redis.set(WAL_SNAPSHOT_KEY(sym), JSON.stringify(snap));
  }

  private async snapshotAll(): Promise<void> {
    for (const [sym, stockId] of this.symToStockId) {
      const book = this.books.getBook(stockId);
      if (book.bidLevels.length === 0 && book.askLevels.length === 0) continue;
      try {
        await this.saveSnapshot(sym, book);
      } catch (e: unknown) {
        this.logger.warn(`snapshot ${sym}: ${String(e)}`);
      }
    }
  }
}
