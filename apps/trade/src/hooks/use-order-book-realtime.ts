'use client';

import { useEffect, useState } from 'react';
import { useTradeRealtimeSocket } from '@/components/trade-realtime-provider';
import { levelTouched, readCornerField } from '@/lib/market-ws-expand';
import { WS_INSTRUMENT_TY, WS_SERVER_EVT } from '@/lib/ws-realtime.constants';

/** Compact keys cho ORDERBOOK_DELTA TOP3 (bảng giá). */
const BID_OB_KEYS = [
  ['B1', 'V1', 'bid1Price', 'bid1Volume'],
  ['B2', 'V2', 'bid2Price', 'bid2Volume'],
  ['B3', 'V3', 'bid3Price', 'bid3Volume'],
] as const;
const ASK_OB_KEYS = [
  ['S1', 'U1', 'ask1Price', 'ask1Volume'],
  ['S2', 'U2', 'ask2Price', 'ask2Volume'],
  ['S3', 'U3', 'ask3Price', 'ask3Volume'],
] as const;

export type LiveOrderBookState = {
  asks: Array<{ price: number; amount: number }>;
  bids: Array<{ price: number; amount: number }>;
  lastPrice: number | null;
  lastDirection: 'up' | 'down' | 'flat';
};

type Level = { price: number; amount: number };

type BookState = {
  sym: string;
  book: LiveOrderBookState | null;
};

/** Apply BOOK_DELTA: chỉ cập nhật các mức có thay đổi, v=0 → xóa mức. */
function applyBookDelta(
  prev: Level[],
  changes: Array<{ p: number; v: number }>,
  sortDesc: boolean,
): Level[] {
  let result = [...prev];
  for (const ch of changes) {
    const idx = result.findIndex((r) => r.price === ch.p);
    if (ch.v === 0) {
      if (idx >= 0) result.splice(idx, 1);
    } else if (idx >= 0) {
      result[idx] = { price: ch.p, amount: ch.v };
    } else {
      result.push({ price: ch.p, amount: ch.v });
      result = result.sort((a, b) =>
        sortDesc ? b.price - a.price : a.price - b.price,
      );
    }
  }
  return result;
}

function mergeMarketDelta(
  prev: LiveOrderBookState | null,
  msg: Record<string, unknown>,
): LiveOrderBookState {
  const tyRaw = msg.ty ?? msg.type;
  const c = (msg.ch ?? msg.changes ?? {}) as Record<string, unknown>;
  let bids = [...(prev?.bids ?? [])];
  let asks = [...(prev?.asks ?? [])];

  if (tyRaw === WS_INSTRUMENT_TY.OB_SNAPSHOT) {
    // Snapshot đầy đủ — thay thế toàn bộ (chỉ emit khi subscribe lần đầu)
    const snapBids = c.bids;
    const snapAsks = c.asks;
    if (Array.isArray(snapBids)) {
      bids = (snapBids as unknown[])
        .map((r) => {
          if (r == null || typeof r !== 'object') return null;
          const rr = r as Record<string, unknown>;
          const price = rr.price;
          const amount = rr.amount;
          if (typeof price === 'number' && typeof amount === 'number')
            return { price, amount };
          return null;
        })
        .filter((x): x is Level => x !== null);
    }
    if (Array.isArray(snapAsks)) {
      asks = (snapAsks as unknown[])
        .map((r) => {
          if (r == null || typeof r !== 'object') return null;
          const rr = r as Record<string, unknown>;
          const price = rr.price;
          const amount = rr.amount;
          if (typeof price === 'number' && typeof amount === 'number')
            return { price, amount };
          return null;
        })
        .filter((x): x is Level => x !== null);
    }
  } else if (tyRaw === WS_INSTRUMENT_TY.BOOK_DELTA) {
    // Delta full-depth — apply từng mức giá thay đổi
    const rawB = c.b;
    const rawA = c.a;
    if (Array.isArray(rawB)) {
      bids = applyBookDelta(
        bids,
        rawB as Array<{ p: number; v: number }>,
        true,
      );
    }
    if (Array.isArray(rawA)) {
      asks = applyBookDelta(
        asks,
        rawA as Array<{ p: number; v: number }>,
        false,
      );
    }
  } else if (tyRaw === 'OB' || tyRaw === WS_INSTRUMENT_TY.ORDERBOOK) {
    // ORDERBOOK_DELTA TOP3 — chỉ dùng khi chưa có snapshot (bảng giá bootstrap)
    const hasSnapshot = bids.length > 0 || asks.length > 0;
    if (!hasSnapshot) {
      let bidTouched = false;
      const slotB: Array<Level | undefined> = [bids[0], bids[1], bids[2]].map(
        (r) => (r ? { ...r } : undefined),
      );
      BID_OB_KEYS.forEach(([B, V, pL, vL], idx) => {
        if (!levelTouched(c, B, V, pL, vL)) return;
        bidTouched = true;
        const pRaw = readCornerField(c, B, pL);
        const vRaw = readCornerField(c, V, vL);
        if (pRaw === null || vRaw === null) {
          slotB[idx] = undefined;
          return;
        }
        const pr = typeof pRaw === 'number' ? pRaw : slotB[idx]?.price;
        const vr = typeof vRaw === 'number' ? vRaw : slotB[idx]?.amount;
        if (pr !== undefined && vr !== undefined && pr > 0 && vr >= 0)
          slotB[idx] = { price: pr, amount: vr };
      });
      if (bidTouched)
        bids = slotB.filter((s): s is Level => s !== undefined);

      let askTouched = false;
      const slotA: Array<Level | undefined> = [asks[0], asks[1], asks[2]].map(
        (r) => (r ? { ...r } : undefined),
      );
      ASK_OB_KEYS.forEach(([S, U, pL, vL], idx) => {
        if (!levelTouched(c, S, U, pL, vL)) return;
        askTouched = true;
        const pRaw = readCornerField(c, S, pL);
        const vRaw = readCornerField(c, U, vL);
        if (pRaw === null || vRaw === null) {
          slotA[idx] = undefined;
          return;
        }
        const pr = typeof pRaw === 'number' ? pRaw : slotA[idx]?.price;
        const vr = typeof vRaw === 'number' ? vRaw : slotA[idx]?.amount;
        if (pr !== undefined && vr !== undefined && pr > 0 && vr >= 0)
          slotA[idx] = { price: pr, amount: vr };
      });
      if (askTouched)
        asks = slotA.filter((s): s is Level => s !== undefined);
    }
    // Đã có snapshot → bỏ qua ORDERBOOK_DELTA, chờ BOOK_DELTA
  }

  let lastPrice = prev?.lastPrice ?? null;
  let lastDirection = prev?.lastDirection ?? 'flat';
  if (tyRaw === 'TT' || tyRaw === 'TRADE_TICK') {
    const lp = c.CP ?? c.lastPrice;
    if (lp != null && Number.isFinite(Number(lp))) lastPrice = Number(lp);
    lastDirection = 'flat';
  }

  return { bids, asks, lastPrice, lastDirection };
}

/** Subscribe một mã (`room:i:<SB>`) + nhận tin `i`. */
export function useOrderBookRealtime(symbol: string): LiveOrderBookState | null {
  const socket = useTradeRealtimeSocket();
  const [live, setLive] = useState<BookState>({ sym: '', book: null });
  const sym = symbol.trim().toUpperCase();

  useEffect(() => {
    if (!socket || !sym) {
      queueMicrotask(() => setLive({ sym: '', book: null }));
      return;
    }

    const subscribe = () => socket.emit('subscribe:i', { SB: [sym] });

    const onInstrument = (msg: unknown) => {
      if (msg == null || typeof msg !== 'object') return;
      const m = msg as Record<string, unknown>;
      const tyRaw = m.ty ?? m.type;
      if (tyRaw === WS_INSTRUMENT_TY.BOOTSTRAP) return;
      const rawSym =
        typeof m.SB === 'string'
          ? m.SB
          : typeof m.symbol === 'string'
            ? m.symbol
            : '';
      if (rawSym.toUpperCase() !== sym) return;
      if (
        tyRaw !== 'OB' &&
        tyRaw !== 'TT' &&
        tyRaw !== WS_INSTRUMENT_TY.ORDERBOOK &&
        tyRaw !== 'TRADE_TICK' &&
        tyRaw !== WS_INSTRUMENT_TY.OB_SNAPSHOT &&
        tyRaw !== WS_INSTRUMENT_TY.BOOK_DELTA
      )
        return;
      setLive((prev) => ({
        sym,
        book: mergeMarketDelta(prev.sym === sym ? prev.book : null, m),
      }));
    };

    socket.on('connect', subscribe);
    socket.on(WS_SERVER_EVT.INSTRUMENT, onInstrument);
    if (socket.connected) subscribe();

    return () => {
      socket.off('connect', subscribe);
      socket.off(WS_SERVER_EVT.INSTRUMENT, onInstrument);
      socket.emit('unsubscribe:i', { SB: [sym] });
    };
  }, [socket, sym]);

  return live.sym === sym ? live.book : null;
}
