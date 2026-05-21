import type { Trade } from '../database/entities/trade.entity';

/**
 * Compact payload cho WS trade event (OT).
 * Giảm byte transmission bằng cách dùng khóa ngắn.
 * FE sẽ decode thành DTO dài tại `market-ws-expand.ts`.
 */
export interface CompactTradePayload {
  // px: price, qty: quantity, ts: timestamp (ISO string)
  px: number;
  qty: number;
  ts: string;
}

/**
 * Map Trade entity thành compact payload cho WS.
 */
export function compactTrade(trade: Trade): CompactTradePayload {
  return {
    px: Number(trade.price),
    qty: trade.quantity,
    ts: trade.createdAt.toISOString(),
  };
}
