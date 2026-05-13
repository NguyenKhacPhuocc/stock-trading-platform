import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { MatchingRegistryService } from './matching-registry.service';
import type { SymbolBook } from './symbol-book';
import type { QueuedOrder } from './matching-types';

const WAL_KEY = (sym: string) => `wal:book:${sym}`;
const SNAPSHOT_KEY = (sym: string) => `wal:snapshot:${sym}`;

/** Giữ 2000 events gần nhất; đủ để replay trong 5 phút với 6 orders/s */
const WAL_MAX_EVENTS = 2000;
/** Snapshot mỗi 5 giây */
const SNAPSHOT_INTERVAL_MS = 5_000;
/** Bỏ qua snapshot quá cũ khi recover (> 5 phút) */
const SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1_000;

type WalSnapshot = {
  seq: string; // Stream ID của WAL event cuối đã được included trong snapshot
  ts: number;
  bids: QueuedOrder[];
  asks: QueuedOrder[];
};

/**
 * WAL (Write-Ahead Log) + Snapshot cho order book.
 *
 * Luồng:
 *   - Mỗi lần REST/REMOVE → XADD vào Redis Stream.
 *   - Mỗi 5s → dump snapshot (full book state + seq cuối) vào Redis String.
 *   - Khi restart → load snapshot → XRANGE từ snapshot.seq → replay events → book rebuilt.
 *
 * Đây là cách hệ thống production (Binance, VPS) phục hồi order book sau restart.
 */
@Injectable()
export class OrderbookWalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderbookWalService.name);
  private timer?: NodeJS.Timeout;

  /** sym → stockId — để snapshot timer truy cập được book qua registry */
  private readonly symToStockId = new Map<string, string>();

  /** Stream ID của WAL event gần nhất theo sym — dùng khi ghi snapshot */
  private readonly lastWalSeq = new Map<string, string>();

  constructor(
    private readonly redis: RedisService,
    private readonly registry: MatchingRegistryService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.snapshotAll();
    }, SNAPSHOT_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ─── Append ──────────────────────────────────────────────────────────────

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
      this.logger.warn(`[WAL] appendRest ${sym}: ${String(e)}`);
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
      this.logger.warn(`[WAL] appendRemove ${sym}: ${String(e)}`);
    }
  }

  private async trimIfNeeded(sym: string): Promise<void> {
    const len = await this.redis.xLen(WAL_KEY(sym));
    if (len > WAL_MAX_EVENTS) {
      await this.redis.xTrim(WAL_KEY(sym), WAL_MAX_EVENTS);
    }
  }

  // ─── Snapshot ────────────────────────────────────────────────────────────

  async saveSnapshot(sym: string, book: SymbolBook): Promise<void> {
    const seq = this.lastWalSeq.get(sym) ?? '0';
    const bids: QueuedOrder[] = [];
    const asks: QueuedOrder[] = [];
    for (const lvl of book.bidLevels)
      for (const o of lvl.orders) bids.push({ ...o });
    for (const lvl of book.askLevels)
      for (const o of lvl.orders) asks.push({ ...o });

    const snap: WalSnapshot = { seq, ts: Date.now(), bids, asks };
    await this.redis.set(SNAPSHOT_KEY(sym), JSON.stringify(snap));
    this.logger.debug(
      `[WAL snapshot] ${sym} seq=${seq} bids=${bids.length} asks=${asks.length}`,
    );
  }

  // ─── Replay ──────────────────────────────────────────────────────────────

  /**
   * Phục hồi book từ snapshot + replay WAL events sau snapshot.
   * Gọi khi client subscribe nhưng book in-memory trống (sau restart).
   * Trả về true nếu recovery thành công (book đã có data).
   */
  async replayIntoBook(
    sym: string,
    stockId: string,
    book: SymbolBook,
  ): Promise<boolean> {
    const snapStr = await this.redis.get(SNAPSHOT_KEY(sym)).catch(() => null);
    if (!snapStr) return false;

    let snap: WalSnapshot;
    try {
      snap = JSON.parse(snapStr) as WalSnapshot;
    } catch {
      return false;
    }

    if (Date.now() - snap.ts > SNAPSHOT_MAX_AGE_MS) {
      this.logger.warn(
        `[WAL] ${sym}: snapshot quá cũ (${Math.round((Date.now() - snap.ts) / 1000)}s), bỏ qua`,
      );
      return false;
    }

    // Restore từ snapshot
    book.restore({ bids: snap.bids, asks: snap.asks });

    // Replay WAL events sau snapshot
    let walEntries: Array<{ id: string; message: Record<string, string> }> = [];
    try {
      walEntries = await this.redis.xRange(WAL_KEY(sym), snap.seq, '+');
    } catch (e: unknown) {
      this.logger.warn(`[WAL] ${sym}: xRange failed: ${String(e)}`);
    }

    let replayed = 0;
    for (const entry of walEntries) {
      // Bỏ qua event đã included trong snapshot (XRANGE inclusive)
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
      `[WAL] ${sym}: phục hồi từ snapshot (seq=${snap.seq}) + replay ${replayed} events → bids=${book.bidLevels.length} asks=${book.askLevels.length} levels`,
    );
    return true;
  }

  // ─── Periodic snapshot ───────────────────────────────────────────────────

  private async snapshotAll(): Promise<void> {
    for (const [sym, stockId] of this.symToStockId) {
      const book = this.registry.getBook(stockId);
      if (book.bidLevels.length === 0 && book.askLevels.length === 0) continue;
      try {
        await this.saveSnapshot(sym, book);
      } catch (e: unknown) {
        this.logger.warn(`[WAL] snapshot ${sym}: ${String(e)}`);
      }
    }
  }
}
