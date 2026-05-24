/** Loại lệnh đặt được trên form (ATO/ATC chưa hỗ trợ — xem UC 3.8). */
export type OrderType = 'LO' | 'MAK';
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

export function parseOrderQuantityInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Lô chẵn HOSE/HNX: bội số 100, tối thiểu 100 CP. */
export function isValidLotQuantity(qty: number): boolean {
  return qty >= 100 && qty % 100 === 0;
}

export function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

/** Ticket từ `POST .../orders/pre-check` — gửi lại khi create-order. */
export type OrderPreCheckIntent = {
  requestId: string;
  transactionId: string;
  tokenId: string;
};

/** Hiển thị modal xác nhận — lấy từ form, không từ pre-check. */
export type OrderConfirmDisplay = {
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  orderPrice: number;
  estimatedTotal: number | null;
};

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
