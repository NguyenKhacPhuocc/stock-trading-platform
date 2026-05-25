import { formatOrderStatusLabel } from '@/components/order/order-types';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
};

export type OrderMatchedPayload = {
  side?: string;
  symbol?: string;
  matchedQty?: number;
  quantity?: number;
  status?: string;
  fillPrice?: number;
  fillQty?: number;
  notification?: NotificationItem;
};

export function parseWsNotification(
  raw: unknown,
): NotificationItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!id) return null;
  return {
    id,
    type: String(o.type ?? ''),
    title: String(o.title ?? ''),
    content: String(o.content ?? ''),
    isRead: Boolean(o.isRead),
    createdAt:
      typeof o.createdAt === 'string'
        ? o.createdAt
        : o.createdAt instanceof Date
          ? o.createdAt.toISOString()
          : '',
  };
}

export function formatOrderMatchedToast(p: OrderMatchedPayload): string {
  const sideLabel = p.side === 'sell' ? 'Bán' : 'Mua';
  const sym = typeof p.symbol === 'string' && p.symbol ? p.symbol.toUpperCase() : '—';
  const matched = Number(p.matchedQty ?? 0);
  const total = Number(p.quantity ?? 0);
  const statusLabel = formatOrderStatusLabel(String(p.status ?? ''));
  const fillQty = Number(p.fillQty ?? 0);
  const fillPrice = Number(p.fillPrice ?? 0);

  if (fillQty > 0 && fillPrice > 0) {
    return `${sym} · ${sideLabel}: khớp ${fillQty.toLocaleString('vi-VN')} @ ${fillPrice.toLocaleString('vi-VN')} — Tổng ${matched.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')} (${statusLabel})`;
  }

  return `${sym} · ${sideLabel}: Tổng khớp ${matched.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')} — ${statusLabel}`;
}

export const NOTIFICATIONS_REFRESH_EVT = 'trade:notifications-refresh';
export const NOTIFICATIONS_PUSH_EVT = 'trade:notifications-push';
export const ORDERS_FOCUS_LIST_EVT = 'trade:orders-focus-list';
export const PORTFOLIO_REFRESH_EVT = 'trade:portfolio-refresh';

/** WS đẩy 1 thông báo mới — chuông cập nhật ngay, không fetch lại. */
export function dispatchNotificationPush(item: NotificationItem): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATIONS_PUSH_EVT, { detail: item }),
    );
  }
}

/** Chỉ dùng khi mount / đăng nhập / fallback. */
export function dispatchNotificationsRefresh(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVT));
  }
}

export function dispatchOrdersFocusList(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ORDERS_FOCUS_LIST_EVT));
  }
}

export function dispatchPortfolioRefresh(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PORTFOLIO_REFRESH_EVT));
  }
}
