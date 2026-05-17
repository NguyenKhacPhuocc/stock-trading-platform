export const ORDERBOOK_CACHE_MAX_LEVELS = 64;

export const orderbookSideRedisKey = (
  symbolUpper: string,
  side: 'buy' | 'sell',
) => `orderbook:${symbolUpper.trim().toUpperCase()}:${side}`;

export const WAL_KEY = (sym: string) => `wal:book:${sym}`;
export const WAL_SNAPSHOT_KEY = (sym: string) => `wal:snapshot:${sym}`;
export const WAL_MAX_EVENTS = 2000;
export const WAL_SNAPSHOT_INTERVAL_MS = 5_000;
export const WAL_SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1_000;
