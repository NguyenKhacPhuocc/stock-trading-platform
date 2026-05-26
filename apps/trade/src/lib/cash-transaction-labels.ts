const LABELS: Record<string, string> = {
  deposit: 'Nạp tiền',
  withdraw: 'Rút tiền',
  buy_lock: 'Phong tỏa mua',
  buy_unlock: 'Hoàn phong tỏa',
  buy_matched: 'Khớp mua',
  sell_matched: 'Khớp bán',
  fee: 'Phí giao dịch',
  adjustment: 'Điều chỉnh',
};

export function formatCashTransactionType(type: string): string {
  return LABELS[type] ?? type;
}
