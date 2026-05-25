import type { OrderFillNotify } from './order-fill-notify.dto';

/** Bản ghi thông báo gửi kèm WS sau khi đã persist DB. */
export type OrderMatchedNotificationWs = {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
};

/** Payload WS `order:matched` — khớp lệnh + thông báo realtime. */
export type OrderMatchedWsPayload = OrderFillNotify & {
  notification: OrderMatchedNotificationWs;
};
