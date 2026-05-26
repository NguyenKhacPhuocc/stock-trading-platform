const LABELS: Record<string, string> = {
  gift: 'Quà / tồn đầu',
  buy_matched: 'Khớp mua',
  sell_lock: 'Phong tỏa bán',
  sell_unlock: 'Hoàn phong tỏa bán',
  sell_matched: 'Khớp bán',
};

export function formatStockLedgerType(type: string): string {
  return LABELS[type] ?? type;
}
