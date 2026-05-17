import type { OrderSide, OrderStatus } from '../../../common/const';

/** Thông báo WS `order:matched` sau khi ghi khớp DB. */
export type OrderFillNotify = {
  orderId: string;
  userId: string;
  status: OrderStatus;
  matchedQty: number;
  quantity: number;
  side: OrderSide;
};
