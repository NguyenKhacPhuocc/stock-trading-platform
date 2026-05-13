/** Khớp `backend/src/websocket/ws-realtime.constants.ts` + `WS_TY` bootstrap. */
export const WS_SERVER_EVT = {
  INSTRUMENT: 'i',
  INDEX: 'idx',
  EXCHANGE: 'e',
} as const;

/** Giá trị `ty` trong payload tin `i`. */
export const WS_INSTRUMENT_TY = {
  BOOTSTRAP: 'MB',
  ORDERBOOK: 'OB',
  TRADE: 'TT',
  BOOK_DELTA: 'BOOK_DELTA',
  OB_SNAPSHOT: 'OB_SNAPSHOT',
} as const;

/** Sàn hợp lệ — trùng `Exchange` Nest. Tab "Tất cả" đăng ký đủ 3 cái. */
export const WS_EXCHANGE_CODES = ['HOSE', 'HNX', 'UPCOM'] as const;

export type WsExchangeCode = (typeof WS_EXCHANGE_CODES)[number];

/** Unique + sort — so sánh tập room subscribe. */
export function sortDedupeStrings(arr: readonly string[]): string[] {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

/** Rooms cần leave / join khi đổi từ prev → next. */
export function diffSubscribeRooms(
  prev: readonly string[] | null | undefined,
  next: readonly string[],
): { leave: string[]; join: string[] } {
  const p = new Set(prev ?? []);
  const n = new Set(next);
  const leave = [...p].filter((x) => !n.has(x));
  const join = [...n].filter((x) => !p.has(x));
  return { leave, join };
}
