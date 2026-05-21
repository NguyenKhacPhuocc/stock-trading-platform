/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTradeRealtimeSocket } from '@/components/trade-realtime-provider';
import { expandCompactTrade, type TradeHistoryItem } from '@/lib/trade-ws-expand';
import { WS_SERVER_EVT } from '@/lib/ws-realtime.constants';
import { GATEWAY_TRADES } from '@/lib/gateway-paths';

export interface UseTradeHistoryOptions {
  stockId: string;
  limit?: number;
}

export interface UseTradeHistoryResult {
  items: TradeHistoryItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook để fetch lịch sử khớp lệnh từ API + subscribe WS realtime updates.
 * - Lấy 20 bản ghi gần nhất từ gateway trades history API
 * - Subscribe vào `room:ot:<stockId>` để nhận trade tick mới
 * - Thêm trade mới vào đầu danh sách (kèm limit tối đa 20 items)
 */
export function useTradeHistory({
  stockId,
  limit = 20,
}: UseTradeHistoryOptions): UseTradeHistoryResult {
  const socket = useTradeRealtimeSocket();
  const [items, setItems] = useState<TradeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    if (!stockId) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = `${GATEWAY_TRADES.history(stockId)}?limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const response = (await res.json()) as { d?: unknown };
      const data = Array.isArray(response.d) ? response.d : [];
      const trades = data.map((t: any) => ({
        price: Number(t.price),
        quantity: t.quantity,
        timestamp: t.createdAt,
      }));
      setItems(trades.slice(0, limit));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch trades');
    } finally {
      setIsLoading(false);
    }
  }, [stockId, limit]);

  useEffect(() => {
    void fetchTrades();
  }, [fetchTrades]);

  useEffect(() => {
    if (!socket || !stockId) return;

    const subscribe = () => {
      socket.emit('subscribe:ot', { stockId });
    };

    const onTradeTick = (msg: unknown) => {
      if (msg == null || typeof msg !== 'object') return;
      const envelope = msg as Record<string, unknown>;
      const data = envelope.data;
      if (data == null || typeof data !== 'object') return;

      const trade = expandCompactTrade(data as Record<string, unknown>);
      setItems((prev) => {
        const updated = [trade, ...prev];
        return updated.slice(0, limit);
      });
    };

    socket.on('connect', subscribe);
    socket.on(WS_SERVER_EVT.ORDER_TRADE, onTradeTick);
    if (socket.connected) subscribe();

    return () => {
      socket.off('connect', subscribe);
      socket.off(WS_SERVER_EVT.ORDER_TRADE, onTradeTick);
      socket.emit('unsubscribe:ot', { stockId });
    };
  }, [socket, stockId, limit]);

  return { items, isLoading, error, refetch: fetchTrades };
}
