'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { batchPatchRows, fetchMarketRows } from '@/store/slices/market.slice';
import {
  compactDeltaToPriceBoardPatch,
  parseInstrumentPatchMessage,
} from '@/lib/market-ws-expand';
import { createMarketPatchQueue } from '@/lib/market-ws-patch-queue';
import { WS_INSTRUMENT_TY, WS_SERVER_EVT } from '@/lib/ws-realtime.constants';

const TradeRealtimeSocketContext = createContext<Socket | null>(null);

export function useTradeRealtimeSocket(): Socket | null {
  return useContext(TradeRealtimeSocketContext);
}

/**
 * Snapshot bảng giá chỉ từ REST (`fetchMarketRows`).
 * Chỉ sau khi API snapshot thành công (`lastSyncedAt`) mới mở WS — chỉ nhận OB/TT.
 */
export function TradeRealtimeProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const lastSyncedAt = useAppSelector((s) => s.market.lastSyncedAt);
  /** `lastSyncedAt` đổi mỗi lần fetch theo tab — không dùng làm dep socket (sẽ đóng/mở WS liên tục). */
  const snapshotReady = lastSyncedAt != null;
  const prefetchStarted = useRef(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (prefetchStarted.current) return;
    prefetchStarted.current = true;
    void dispatch(fetchMarketRows({ exchange: 'ALL' }));
  }, [dispatch]);

  useEffect(() => {
    if (!snapshotReady) return;

    const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://127.0.0.1:3002';
    const s = io(url, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    const patchQueue = createMarketPatchQueue((items) => {
      dispatch(batchPatchRows(items));
    });

    const onInstrument = (msg: unknown) => {
      if (msg == null || typeof msg !== 'object') return;
      const ty = (msg as Record<string, unknown>).ty;
      if (ty === WS_INSTRUMENT_TY.BOOTSTRAP) {
        return;
      }
      const parsed = parseInstrumentPatchMessage(msg);
      if (!parsed) return;
      const patch = compactDeltaToPriceBoardPatch(parsed.ch);
      if (Object.keys(patch).length === 0) return;
      patchQueue.push(parsed.symbol, patch);
    };

    s.on(WS_SERVER_EVT.INSTRUMENT, onInstrument);
    queueMicrotask(() => setSocket(s));

    return () => {
      patchQueue.dispose();
      s.off(WS_SERVER_EVT.INSTRUMENT, onInstrument);
      s.close();
      queueMicrotask(() => setSocket(null));
    };
  }, [dispatch, snapshotReady]);

  return (
    <TradeRealtimeSocketContext.Provider value={socket}>
      {children}
    </TradeRealtimeSocketContext.Provider>
  );
}
