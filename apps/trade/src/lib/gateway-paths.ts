export const TRADE_BASE_PATH = '/trade';

export function gatewayMarketBoardPath(params?: {
  exchange?: string;
  withQuotes?: boolean;
}): string {
  const search = new URLSearchParams();
  const ex = params?.exchange;
  if (ex && ex !== 'ALL') search.set('exchange', ex);
  if (params?.withQuotes === true) search.set('quote', 'true');
  const q = search.toString();
  return `${TRADE_BASE_PATH}/api/gateway/market/board${q ? `?${q}` : ''}`;
}

// ─── Auth gateway paths ───────────────────────────────────────────────────────

const AUTH_GW = `${TRADE_BASE_PATH}/api/gateway/auth`;

export const GATEWAY_AUTH = {
  login: `${AUTH_GW}/login`,
  register: `${AUTH_GW}/register`,
  logout: `${AUTH_GW}/logout`,
  refresh: `${AUTH_GW}/refresh`,
  session: `${AUTH_GW}/session`,
  forgotPasswordRequest: `${AUTH_GW}/forgot-password/request`,
  forgotPasswordConfirm: `${AUTH_GW}/forgot-password/confirm`,
} as const;

// ─── Users gateway paths ────────────────────────────────────────────────────────

const USERS_GW = `${TRADE_BASE_PATH}/api/gateway/users`;

export const GATEWAY_USERS = {
  profile: `${USERS_GW}/me`,
  changePassword: `${USERS_GW}/me/password`,
  setupTradingPin: `${USERS_GW}/me/trading-pin`,
  changeTradingPin: `${USERS_GW}/me/trading-pin/change`,
  loginHistory: `${USERS_GW}/me/login-history`,
  profileChangeHistory: `${USERS_GW}/me/profile-change-history`,
} as const;

// ─── Wallet gateway paths ─────────────────────────────────────────────────────

const WALLET_GW = `${TRADE_BASE_PATH}/api/gateway/wallet`;

export const GATEWAY_WALLET = {
  /** Sức mua + danh mục (sức bán theo mã) — dùng cho màn đặt lệnh */
  portfolio: `${WALLET_GW}/portfolio`,
  /** NAV, tiền, vị thế, P/L — trang danh mục */
  overview: `${WALLET_GW}/overview`,
  summary: WALLET_GW,
  positions: `${WALLET_GW}/positions`,
  cashStatement: `${WALLET_GW}/cash-statement`,
  stockStatement: `${WALLET_GW}/stock-statement`,
  sellFills: `${WALLET_GW}/sell-fills`,
  accountTrades: `${WALLET_GW}/account-trades`,
  navHistory: `${WALLET_GW}/nav-history`,
} as const;

// ─── Notifications gateway paths ──────────────────────────────────────────────

const NOTIFICATIONS_GW = `${TRADE_BASE_PATH}/api/gateway/notifications`;

export const GATEWAY_NOTIFICATIONS = {
  list: NOTIFICATIONS_GW,
  readAll: `${NOTIFICATIONS_GW}/read-all`,
  read: (id: string) => `${NOTIFICATIONS_GW}/${id}/read`,
} as const;

// ─── Orders gateway paths ─────────────────────────────────────────────────────

const ORDERS_GW = `${TRADE_BASE_PATH}/api/gateway/orders`;

export const GATEWAY_ORDERS = {
  list: ORDERS_GW,
  place: ORDERS_GW,
  preCheck: `${ORDERS_GW}/pre-check`,
  cancel: (id: string) => `${ORDERS_GW}/${id}/cancel`,
} as const;

// ─── Trades gateway paths ─────────────────────────────────────────────────────

const TRADES_GW = `${TRADE_BASE_PATH}/api/gateway/trades`;

export const GATEWAY_TRADES = {
  history: (stockId: string) => `${TRADES_GW}/history/${stockId}`,
} as const;
