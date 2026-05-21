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
} as const;

// ─── Orders gateway paths ─────────────────────────────────────────────────────

const ORDERS_GW = `${TRADE_BASE_PATH}/api/gateway/orders`;

export const GATEWAY_ORDERS = {
  list: ORDERS_GW,
  place: ORDERS_GW,
  cancel: (id: string) => `${ORDERS_GW}/${id}/cancel`,
} as const;

// ─── Trades gateway paths ─────────────────────────────────────────────────────

const TRADES_GW = `${TRADE_BASE_PATH}/api/gateway/trades`;

export const GATEWAY_TRADES = {
  history: (stockId: string) => `${TRADES_GW}/history/${stockId}`,
} as const;
