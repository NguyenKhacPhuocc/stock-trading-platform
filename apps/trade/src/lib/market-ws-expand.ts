import type { ExchangeCode, PriceBoardRow } from '@/components/priceboard/price-board-types';
import type { MarketInstrumentApi } from '@/store/slices/market.slice';
import { mapInstrumentApiToRow } from '@/store/slices/market.slice';

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function coalesce<T>(compactKey: string, longKey: string, ch: Record<string, unknown>): T | undefined {
  if (compactKey in ch) return ch[compactKey] as T;
  if (longKey in ch) return ch[longKey] as T;
  return undefined;
}

/**
 * Bootstrap WS compact (`SB`/`B1`/…) → một dòng bảng giá — không qua `MarketInstrumentApi`.
 * Khớp field backend `market-ws-compact.ts`.
 */
export function compactBootstrapRecordToPriceBoardRow(
  o: Record<string, unknown>,
): PriceBoardRow | null {
  if (typeof o.SB !== 'string' || !o.SB.trim()) return null;
  const symbol = o.SB.trim().toUpperCase();
  return {
    id: String(o.SI ?? symbol),
    symbol,
    exchange: String(o.EX || 'HOSE') as ExchangeCode,
    ref: toNumber(o.RE),
    ceil: toNumber(o.CL),
    floor: toNumber(o.FL),
    bid3: { p: toNumber(o.B3), v: toNumber(o.V3) },
    bid2: { p: toNumber(o.B2), v: toNumber(o.V2) },
    bid1: { p: toNumber(o.B1), v: toNumber(o.V1) },
    match: {
      p: toNumber(o.CP),
      v: toNumber(o.CV),
      priceChange: toNumber(o.CH),
      priceChangePercent: toNumber(o.CHP),
    },
    ask1: { p: toNumber(o.S1), v: toNumber(o.U1) },
    ask2: { p: toNumber(o.S2), v: toNumber(o.U2) },
    ask3: { p: toNumber(o.S3), v: toNumber(o.U3) },
    totalVol: toNumber(o.TT),
    high: toNumber(o.HI),
    low: toNumber(o.LO),
  };
}

/**
 * Delta WS — đọc **khóa ngắn trước**, fallback tên dài (legacy) trong **một** bước → patch Redux.
 */
export function levelTouched(
  ch: Record<string, unknown>,
  pShort: string,
  vShort: string,
  pLong: string,
  vLong: string,
): boolean {
  return pShort in ch || vShort in ch || pLong in ch || vLong in ch;
}

export function readCornerField(
  ch: Record<string, unknown>,
  shortK: string,
  longK: string,
): number | undefined | null {
  if (!(shortK in ch) && !(longK in ch)) return undefined;
  const x = shortK in ch ? ch[shortK] : ch[longK];
  if (x === null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

export function compactDeltaToPriceBoardPatch(ch: Record<string, unknown>): Partial<PriceBoardRow> {
  const patch: Partial<PriceBoardRow> = {};
  const bidLevels: Array<{
    row: 'bid1' | 'bid2' | 'bid3';
    B: string;
    V: string;
    pL: string;
    vL: string;
  }> = [
    { row: 'bid1', B: 'B1', V: 'V1', pL: 'bid1Price', vL: 'bid1Volume' },
    { row: 'bid2', B: 'B2', V: 'V2', pL: 'bid2Price', vL: 'bid2Volume' },
    { row: 'bid3', B: 'B3', V: 'V3', pL: 'bid3Price', vL: 'bid3Volume' },
  ];
  for (const { row, B, V, pL, vL } of bidLevels) {
    if (!levelTouched(ch, B, V, pL, vL)) continue;
    const pVal = readCornerField(ch, B, pL);
    const vVal = readCornerField(ch, V, vL);
    if (pVal === null || vVal === null) {
      (patch as Record<string, { p: number; v: number }>)[row] = { p: 0, v: 0 };
      continue;
    }
    const piece: Partial<PriceBoardRow['bid1']> = {};
    if (typeof pVal === 'number') piece.p = pVal;
    if (typeof vVal === 'number') piece.v = vVal;
    if (Object.keys(piece).length > 0) {
      patch[row as 'bid1'] = piece as PriceBoardRow['bid1'];
    }
  }
  const askLevels: Array<{
    row: 'ask1' | 'ask2' | 'ask3';
    S: string;
    U: string;
    pL: string;
    vL: string;
  }> = [
    { row: 'ask1', S: 'S1', U: 'U1', pL: 'ask1Price', vL: 'ask1Volume' },
    { row: 'ask2', S: 'S2', U: 'U2', pL: 'ask2Price', vL: 'ask2Volume' },
    { row: 'ask3', S: 'S3', U: 'U3', pL: 'ask3Price', vL: 'ask3Volume' },
  ];
  for (const { row, S, U, pL, vL } of askLevels) {
    if (!levelTouched(ch, S, U, pL, vL)) continue;
    const pVal = readCornerField(ch, S, pL);
    const vVal = readCornerField(ch, U, vL);
    if (pVal === null || vVal === null) {
      (patch as Record<string, { p: number; v: number }>)[row] = { p: 0, v: 0 };
      continue;
    }
    const piece: Partial<PriceBoardRow['ask1']> = {};
    if (typeof pVal === 'number') piece.p = pVal;
    if (typeof vVal === 'number') piece.v = vVal;
    if (Object.keys(piece).length > 0) {
      patch[row as 'ask1'] = piece as PriceBoardRow['ask1'];
    }
  }
  const lastP = coalesce<unknown>('CP', 'lastPrice', ch);
  const matchedV = coalesce<unknown>('CV', 'matchedVolume', ch);
  const changePct = ch.changePercent;
  if (lastP != null || matchedV != null || changePct != null) {
    patch.match = {
      ...(lastP != null ? { p: Number(lastP) } : {}),
      ...(matchedV != null ? { v: Number(matchedV) } : {}),
      ...(changePct != null
        ? {
            priceChange: Number(changePct),
            priceChangePercent: Number(changePct),
          }
        : {}),
    } as PriceBoardRow['match'];
  }
  return patch;
}

/** Payload đơn (REST long-key hoặc WS compact) → một dòng — tối đa một lần map. */
export function instrumentPayloadToRow(raw: unknown): PriceBoardRow | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.SB === 'string') return compactBootstrapRecordToPriceBoardRow(o);
  if (typeof o.symbol === 'string') return mapInstrumentApiToRow(o as MarketInstrumentApi);
  return null;
}

/** Tin `i` với `ty` OB|TT — patch một mã (TOP sổ / tick khớp). */
export function parseInstrumentPatchMessage(msg: unknown): {
  ty: string;
  symbol: string;
  ch: Record<string, unknown>;
} | null {
  if (msg == null || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  const tyRaw = m.ty ?? m.type;
  const ty =
    tyRaw === 'OB' || tyRaw === 'ORDERBOOK_DELTA'
      ? 'OB'
      : tyRaw === 'TT' || tyRaw === 'TRADE_TICK'
        ? 'TT'
        : null;
  const symbol =
    typeof m.SB === 'string'
      ? m.SB
      : typeof m.symbol === 'string'
        ? m.symbol
        : '';
  const rawCh = m.ch ?? m.changes;
  if (!ty || !symbol || rawCh == null || typeof rawCh !== 'object') return null;
  return {
    ty,
    symbol: symbol.toUpperCase(),
    ch: rawCh as Record<string, unknown>,
  };
}
