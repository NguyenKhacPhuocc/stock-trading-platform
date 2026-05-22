export type Exchange = 'HOSE' | 'HNX' | 'UPCOM';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'LO' | 'MAK' | 'ATO' | 'ATC';
export type OrderStatus =
  | 'pending'
  | 'partial'
  | 'partial_cancelled'
  | 'filled'
  | 'cancelled'
  | 'rejected';
export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  custId: string;
  fullName: string;
  email: string | null;
  phone?: string | null;
  role: UserRole;
  createdAt: string;
}

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  exchange: Exchange;
  floorPct: number;
  ceilPct: number;
  isActive: boolean;
}

export interface PriceHistory {
  id: string;
  stockId: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
}

export interface Order {
  id: string;
  orderCode: string | null;
  tradingAccountId: string;
  stockId: string;
  side: OrderSide;
  orderType: OrderType;
  price: number | null;
  quantity: number;
  matchedQty: number;
  avgMatchedPrice?: number | null;
  status: OrderStatus;
  createdAt: string;
  stock?: Pick<Stock, 'symbol' | 'name'>;
}

export interface Trade {
  id: string;
  price: number;
  quantity: number;
  createdAt: string;
}

export interface Wallet {
  id: string;
  tradingAccountId: string;
  accountId: string;
  availableBalance: number;
  lockedBalance: number;
  /** Tổng = available + locked (tính từ snapshot, đồng bộ qua ledger) */
  totalBalance: number;
  updatedAt: string;
}

export interface Position {
  id: string;
  tradingAccountId: string;
  stockId: string;
  /** Khối lượng khả dụng (chưa phong tỏa lệnh bán) */
  quantity: number;
  lockedQuantity: number;
  /** Tổng nắm giữ = quantity + lockedQuantity */
  totalQuantity: number;
  avgPrice: number;
  stock: Pick<Stock, 'symbol' | 'name' | 'exchange'>;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface ApiEnvelope<T> {
  s: 'ok' | 'error';
  ec: number | string;
  em: string;
  d: T | null;
}

/** Phản hồi thành công — khớp Nest `ResponseInterceptor` */
export type ApiOkEnvelope<T> = {
  s: 'ok';
  ec: 0;
  em: '';
  d: T;
};

/** Phản hồi lỗi — khớp Nest `GlobalExceptionFilter` */
export type ApiErrorEnvelope = {
  s: 'error';
  ec: number | string;
  em: string;
  d: null;
};

export type ApiResult<T> = ApiOkEnvelope<T> | ApiErrorEnvelope;

export type RealtimeEnvelope<TData = unknown> = {
  type: string;
  seq: number;
  ts: string;
  data: TData;
};

/** Payload `d` của `GET .../gateway/market/board` */
export type MarketBoardGatewayD = {
  instruments: unknown[];
  quotes?: unknown[];
};
