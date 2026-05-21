/**
 * DTO cho realtime trade event (OT).
 * Mở rộng từ compact payload: { px, qty, ts }
 */
export interface TradeHistoryItem {
  price: number;
  quantity: number;
  timestamp: string; // ISO string
}

/**
 * Expand compact WS trade payload thành DTO.
 */
export function expandCompactTrade(payload: Record<string, unknown>): TradeHistoryItem {
  return {
    price: Number(payload.px) || 0,
    quantity: Number(payload.qty) || 0,
    timestamp: typeof payload.ts === 'string' ? payload.ts : new Date().toISOString(),
  };
}
