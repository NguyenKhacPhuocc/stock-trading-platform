import type { PriceBoardRow } from '@/components/priceboard/price-board-types';
import { mergePriceBoardPatches } from '@/lib/market-patch-merge';

export type QueuedBoardPatch = { symbol: string; patch: Partial<PriceBoardRow> };

/** Gom WS delta theo frame — giảm số lần dispatch Redux khi burst tick. */
export function createMarketPatchQueue(flush: (items: QueuedBoardPatch[]) => void) {
  const pending = new Map<string, Partial<PriceBoardRow>>();
  let rafId: number | null = null;

  const flushNow = () => {
    rafId = null;
    if (pending.size === 0) return;
    const items = [...pending.entries()].map(([symbol, patch]) => ({
      symbol,
      patch,
    }));
    pending.clear();
    flush(items);
  };

  return {
    push(symbol: string, patch: Partial<PriceBoardRow>) {
      const prev = pending.get(symbol);
      pending.set(
        symbol,
        prev ? mergePriceBoardPatches(prev, patch) : patch,
      );
      if (rafId == null) {
        rafId = requestAnimationFrame(flushNow);
      }
    },
    dispose() {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      pending.clear();
    },
  };
}
