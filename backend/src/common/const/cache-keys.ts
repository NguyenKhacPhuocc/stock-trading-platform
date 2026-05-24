/** Redis cache keys — tập trung để dễ tìm và tránh trùng */
export const CacheKey = {
  MARKET_PRICES: 'market:prices',
  MARKET_SYMBOLS: 'market:symbols',
} as const;

/** OTP quên mật khẩu — theo custId */
export const authPasswordResetKey = (custId: string) =>
  `auth:pwd-reset:${custId.toUpperCase()}`;

export const authPasswordResetCooldownKey = (custId: string) =>
  `auth:pwd-reset:cooldown:${custId.toUpperCase()}`;

/** key dùng chung cho dữ liệu symbols (full snapshot payload) */
export const marketSymbolsCacheKey = (date: string, scope: string) =>
  `${CacheKey.MARKET_SYMBOLS}:${date}:${scope}`;
export const MARKET_SYMBOLS_CACHE_PREFIX = `${CacheKey.MARKET_SYMBOLS}:`;

/** TTL (giây) cho từng loại cache */
export const CacheTtl = {
  MARKET_PRICES: 5,
  MARKET_SYMBOLS: 300,
  PASSWORD_RESET_OTP: 600,
  PASSWORD_RESET_COOLDOWN: 60,
  ORDER_INTENT: 120,
} as const;

/** TTL symbols cache: 24h, có dọn key phiên cũ khi ingest ngày mới */
export const CACHE_TTL_MARKET_QUOTES = 86_400;
