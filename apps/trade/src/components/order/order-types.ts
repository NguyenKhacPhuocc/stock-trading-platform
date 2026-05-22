export type OrderType = 'LO' | 'MAK' | 'ATO' | 'ATC';
export type OrderSide = 'buy' | 'sell';
export type BottomTab = 'orders' | 'watchlist' | 'conditional';
export type OrderEntryTab = 'regular' | 'conditional';

export type SymbolOption = {
  /** UUID cổ phiếu — lấy từ quotes (đủ kể cả khi `entities` chỉ có một sàn). */
  stockId: string;
  symbol: string;
  exchange: string;
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ khớp',
  partial: 'Khớp một phần (đang treo)',
  partial_cancelled: 'Khớp một phần, hủy phần còn',
  filled: 'Đã khớp hết',
  cancelled: 'Đã hủy',
  rejected: 'Từ chối',
};

export function formatOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function orderRemainingQty(quantity: number, matchedQty: number): number {
  return Math.max(0, quantity - matchedQty);
}

/** Cột "KL còn" (lệnh đang chờ) hoặc "KL hủy" (đã kết thúc phần dư). */
export function formatOrderRemainingLabel(
  status: string,
  quantity: number,
  matchedQty: number,
): { header: string; value: string } {
  const rem = orderRemainingQty(quantity, matchedQty);
  if (rem <= 0) return { header: 'KL còn/hủy', value: '--' };
  if (status === 'pending' || status === 'partial') {
    return { header: 'KL còn', value: rem.toLocaleString('vi-VN') };
  }
  if (status === 'partial_cancelled' || status === 'cancelled') {
    return { header: 'KL hủy', value: rem.toLocaleString('vi-VN') };
  }
  return { header: 'KL còn/hủy', value: '--' };
}
