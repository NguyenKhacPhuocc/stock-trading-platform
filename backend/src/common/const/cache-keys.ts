/** Redis cache keys — tập trung để dễ tìm và tránh trùng */
export const CacheKey = {
  MARKET_PRICES: 'market:prices',
  MARKET_SYMBOLS: 'market:symbols',
} as const;

/** key dùng chung cho dữ liệu symbols (full snapshot payload) */
export const marketSymbolsCacheKey = (date: string, scope: string) =>
  `${CacheKey.MARKET_SYMBOLS}:${date}:${scope}`;
export const MARKET_SYMBOLS_CACHE_PREFIX = `${CacheKey.MARKET_SYMBOLS}:`;

/** TTL (giây) cho từng loại cache */
export const CacheTtl = {
  MARKET_PRICES: 5,
  MARKET_SYMBOLS: 300,
} as const;

/** TTL symbols cache: 24h, có dọn key phiên cũ khi ingest ngày mới */
export const CACHE_TTL_MARKET_QUOTES = 86_400;
