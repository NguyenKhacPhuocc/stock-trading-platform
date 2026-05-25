export function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

export function formatSignedVnd(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '' : '';
  return `${sign}${formatVnd(amount)}`;
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
