/** Số mức giá tối đa ghi cache (mỗi mức = 1 field giá → KL trong Hash). */
export const ORDERBOOK_CACHE_MAX_LEVELS = 64;

/**
 * Hash một phía sổ: field = giá (chuỗi), value = KL — VD `orderbook:VCB:buy` / `orderbook:VCB:sell`.
 */
export const orderbookSideRedisKey = (
  symbolUpper: string,
  side: 'buy' | 'sell',
) =>
  `orderbook:${symbolUpper.trim().toUpperCase()}:${side}`;
