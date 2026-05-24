import type { OrderSide, OrderType } from '../../../common/const';

export const ORDER_INTENT_TTL_SEC = 120;

export const orderIntentByTxKey = (transactionId: string) =>
  `order:intent:tx:${transactionId}`;

export const orderIntentByTokenKey = (tokenId: string) =>
  `order:intent:token:${tokenId}`;

/** Snapshot lệnh sau pre-check — lưu Redis, dùng một lần khi create. */
export type StoredOrderIntent = {
  userId: string;
  tradingAccountId: string;
  stockId: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  orderPrice: number;
  requestId: string;
  tokenId: string;
  transactionId: string;
};
