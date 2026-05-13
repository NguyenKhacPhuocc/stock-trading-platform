import type { OrderSide } from '../../common/const';

/** Lệnh chờ trong book (memory) — authoritative cho khớp. */
export type QueuedOrder = {
  orderId: string;
  tradingAccountId: string;
  stockId: string;
  side: OrderSide;
  price: number;
  remainingQty: number;
  createdAtMs: number;
};

export type TradeFillPlan = {
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  /** Giá khớp = giá lệnh passive (maker). */
  price: number;
  buyerAccountId: string;
  sellerAccountId: string;
};
