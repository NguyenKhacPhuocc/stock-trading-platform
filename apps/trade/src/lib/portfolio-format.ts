export function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

export function formatSignedVnd(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '' : '';
  return `${sign}${formatVnd(amount)}`;
}

/** Đơn vị tiền chuẩn hiển thị (khoảng trắng trước VNĐ). */
export const VND_UNIT = ' VNĐ';

export function formatVndUnit(amount: number): string {
  return `${formatVnd(amount)}${VND_UNIT}`;
}

export function formatSignedVndUnit(amount: number): string {
  return `${formatSignedVnd(amount)}${VND_UNIT}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function pnlColorClass(value: number): string {
  if (value > 0) return 'text-green-500';
  if (value < 0) return 'text-red-500';
  return 'text-foreground';
}

/** Che số kiểu ban đầu — đủ ký tự `•` bằng độ dài chuỗi gốc để không nhảy layout. */
export function concealBalanceText(text: string): string {
  return '•'.repeat(text.length);
}

export function displayBalanceText(text: string, hidden: boolean): string {
  return hidden ? concealBalanceText(text) : text;
}
