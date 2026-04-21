export type Exchange = 'HOSE' | 'HNX' | 'UPCOM';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'LO' | 'ATO' | 'ATC';
export type OrderStatus = 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected';
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
  tradingAccountId: string;
  stockId: string;
  side: OrderSide;
  orderType: OrderType;
  price?: number;
  quantity: number;
  matchedQty: number;
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
  quantity: number;
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

/** Body chuẩn API backend: s=status, ec=error code (0 = OK), em=error message, d=data */
export interface ApiEnvelope<T> {
  s: 'ok' | 'error';
  ec: number;
  em: string;
  d: T | null;
}
