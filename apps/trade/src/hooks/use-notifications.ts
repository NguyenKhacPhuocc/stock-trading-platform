'use client';

import { useCallback, useEffect, useState } from 'react';
import { GATEWAY_NOTIFICATIONS } from '@/lib/gateway-paths';
import {
  NOTIFICATIONS_PUSH_EVT,
  NOTIFICATIONS_REFRESH_EVT,
  type NotificationItem,
  parseWsNotification,
} from '@/lib/order-fill-notify';

export type { NotificationItem };

const MAX_NOTIFICATIONS = 50;

function mapNotification(row: Record<string, unknown>): NotificationItem | null {
  return parseWsNotification(row);
}

function prependNotification(
  prev: NotificationItem[],
  item: NotificationItem,
): NotificationItem[] {
  if (prev.some((n) => n.id === item.id)) return prev;
  return [item, ...prev].slice(0, MAX_NOTIFICATIONS);
}

export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const res = await fetch(GATEWAY_NOTIFICATIONS.list, {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.s !== 'ok') return;
      const rows = Array.isArray(json.d) ? json.d : [];
      const mapped = rows
        .map((r: Record<string, unknown>) => mapNotification(r))
        .filter((x): x is NotificationItem => x != null);
      setItems(mapped);
    } catch {
      /* thông báo phụ */
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;

    const onPush = (e: Event) => {
      const item = (e as CustomEvent<NotificationItem>).detail;
      if (!item?.id) return;
      setItems((prev) => prependNotification(prev, item));
    };

    const onRefresh = () => void reload();

    window.addEventListener(NOTIFICATIONS_PUSH_EVT, onPush);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVT, onRefresh);
    return () => {
      window.removeEventListener(NOTIFICATIONS_PUSH_EVT, onPush);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVT, onRefresh);
    };
  }, [enabled, reload]);

  const markRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(GATEWAY_NOTIFICATIONS.read(id), {
        method: 'PATCH',
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const res = await fetch(GATEWAY_NOTIFICATIONS.readAll, {
        method: 'PATCH',
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      /* ignore */
    }
  }, []);

  const unreadCount = items.filter((n) => !n.isRead).length;

  return { items, isLoading, unreadCount, reload, markRead, markAllRead };
}
