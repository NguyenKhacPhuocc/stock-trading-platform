import type { OrderSide } from '../../../common/const';
import type { WS_TY } from '../../../websocket/market-ws-compact';

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
  price: number;
  buyerAccountId: string;
  sellerAccountId: string;
};

export type MarketDeltaEnvelope = {
  ty: typeof WS_TY.ORDERBOOK_DELTA | typeof WS_TY.TRADE_TICK;
  q: number;
  SB: string;
  ch: Record<string, unknown>;
};
