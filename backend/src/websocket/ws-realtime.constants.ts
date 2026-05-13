import { Exchange } from '../common/const/market';

/**
 * Sự kiện WS — có nghĩa cố định:
 * - i   = instrument (mã CK)
 * - idx = index chỉ số (sau này)
 * - e   = exchange (tổng hợp theo sàn)
 */
export const WS_EVT = {
  INSTRUMENT: 'i',
  INDEX: 'idx',
  EXCHANGE: 'e',
} as const;

const EX_SET = new Set<string>(Object.values(Exchange));

/** `room:i:<SB>` — một mã cụ thể (chi tiết / yêu thích lẻ). */
export function wsRoomInstrument(symbolUpper: string): string {
  return `room:i:${symbolUpper}`;
}

/** `room:e:<EX>` — HOSE | HNX | UPCOM (tab bảng giá theo sàn). */
export function wsRoomExchange(exchangeUpper: string): string {
  return `room:e:${exchangeUpper}`;
}

/** Room chỉ số (dự phòng). */
export const WS_ROOM_IDX = 'room:idx';

export function isAllowedWsExchange(ex: string): boolean {
  return EX_SET.has(ex.toUpperCase());
}
