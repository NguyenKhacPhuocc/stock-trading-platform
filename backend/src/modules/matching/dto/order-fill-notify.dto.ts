import type { OrderSide, OrderStatus } from '../../../common/const';

/** Thông báo WS `order:matched` sau khi ghi khớp DB. */
export type OrderFillNotify = {
  orderId: string;
  userId: string;
  status: OrderStatus;
  matchedQty: number;
  quantity: number;
  side: OrderSide;
  symbol: string;
  /** Giá khớp của lần khớp vừa xảy ra (0 nếu chỉ cập nhật trạng thái MAK). */
  fillPrice: number;
  fillQty: number;
};
