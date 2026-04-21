/** Redis cache keys — tập trung để dễ tìm và tránh trùng */
export const CacheKey = {
  MARKET_PRICES: 'market:prices',
  MARKET_INSTRUMENTS: 'market:instruments',
} as const;

/**
 * quotes: key = ngày + scope — ALL hoặc danh sách mã sort (tránh cache ALL lẫn subset ?symbols=).
 */
export const marketQuotesCacheKey = (date: string, scope: string) =>
  `market:quotes:${date}:${scope}`;

/** TTL (giây) cho từng loại cache */
export const CacheTtl = {
  MARKET_PRICES: 5,
  MARKET_INSTRUMENTS: 3,
} as const;

/** TTL quotes: 24h — qua ngày mới key đổi nên tự miss, không cần xóa thủ công */
export const CACHE_TTL_MARKET_QUOTES = 86_400;
