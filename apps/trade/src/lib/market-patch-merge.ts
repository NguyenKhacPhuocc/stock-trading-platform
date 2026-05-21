import type { PriceBoardRow } from '@/components/priceboard/price-board-types';

type Corner = { p: number; v: number };

function mergeCorner(prev: Corner, patch?: Partial<Corner>): Corner {
  if (!patch) return prev;
  return {
    p: patch.p ?? prev.p,
    v: patch.v ?? prev.v,
  };
}

function cornerChanged(a: Corner, b: Corner): boolean {
  return a.p !== b.p || a.v !== b.v;
}

/** Gộp nhiều WS delta cùng mã trong một frame. */
export function mergePriceBoardPatches(
  base: Partial<PriceBoardRow> | undefined,
  incoming: Partial<PriceBoardRow>,
): Partial<PriceBoardRow> {
  if (!base) return incoming;
  const out: Partial<PriceBoardRow> = { ...base, ...incoming };
  if (base.bid3 || incoming.bid3) {
    out.bid3 = mergeCorner(base.bid3 ?? { p: 0, v: 0 }, incoming.bid3);
  }
  if (base.bid2 || incoming.bid2) {
    out.bid2 = mergeCorner(base.bid2 ?? { p: 0, v: 0 }, incoming.bid2);
  }
  if (base.bid1 || incoming.bid1) {
    out.bid1 = mergeCorner(base.bid1 ?? { p: 0, v: 0 }, incoming.bid1);
  }
  if (base.ask1 || incoming.ask1) {
    out.ask1 = mergeCorner(base.ask1 ?? { p: 0, v: 0 }, incoming.ask1);
  }
  if (base.ask2 || incoming.ask2) {
    out.ask2 = mergeCorner(base.ask2 ?? { p: 0, v: 0 }, incoming.ask2);
  }
  if (base.ask3 || incoming.ask3) {
    out.ask3 = mergeCorner(base.ask3 ?? { p: 0, v: 0 }, incoming.ask3);
  }
  if (base.match || incoming.match) {
    out.match = { ...base.match, ...incoming.match } as PriceBoardRow['match'];
  }
  return out;
}

/** Áp patch lên row — giữ reference nested field không đổi. */
export function applyPriceBoardPatch(
  current: PriceBoardRow,
  patch: Partial<PriceBoardRow>,
): PriceBoardRow | null {
  const bid3 = patch.bid3 ? mergeCorner(current.bid3, patch.bid3) : current.bid3;
  const bid2 = patch.bid2 ? mergeCorner(current.bid2, patch.bid2) : current.bid2;
  const bid1 = patch.bid1 ? mergeCorner(current.bid1, patch.bid1) : current.bid1;
  const ask1 = patch.ask1 ? mergeCorner(current.ask1, patch.ask1) : current.ask1;
  const ask2 = patch.ask2 ? mergeCorner(current.ask2, patch.ask2) : current.ask2;
  const ask3 = patch.ask3 ? mergeCorner(current.ask3, patch.ask3) : current.ask3;
  const match = patch.match
    ? {
        p: patch.match.p ?? current.match.p,
        v: patch.match.v ?? current.match.v,
        priceChange: patch.match.priceChange ?? current.match.priceChange,
        priceChangePercent:
          patch.match.priceChangePercent ?? current.match.priceChangePercent,
      }
    : current.match;
  const matchSame =
    match.p === current.match.p &&
    match.v === current.match.v &&
    match.priceChange === current.match.priceChange &&
    match.priceChangePercent === current.match.priceChangePercent;
  const matchRef = matchSame ? current.match : match;

  const ref = patch.ref ?? current.ref;
  const ceil = patch.ceil ?? current.ceil;
  const floor = patch.floor ?? current.floor;
  const totalVol = patch.totalVol ?? current.totalVol;
  const high = patch.high ?? current.high;
  const low = patch.low ?? current.low;

  const unchanged =
    bid3 === current.bid3 &&
    bid2 === current.bid2 &&
    bid1 === current.bid1 &&
    ask1 === current.ask1 &&
    ask2 === current.ask2 &&
    ask3 === current.ask3 &&
    matchRef === current.match &&
    ref === current.ref &&
    ceil === current.ceil &&
    floor === current.floor &&
    totalVol === current.totalVol &&
    high === current.high &&
    low === current.low;

  if (unchanged) return null;

  return {
    ...current,
    ref,
    ceil,
    floor,
    totalVol,
    high,
    low,
    bid3,
    bid2,
    bid1,
    match: matchRef,
    ask1,
    ask2,
    ask3,
  };
}
