import type { CSSProperties } from 'react';

/** Lưới 24 cột: mã + 23 ô (div grid, sau này có thể gắn react-window). */
export const PRICE_BOARD_GRID_COLS = '100px repeat(23, minmax(40px, 1fr))';

export const priceBoardGridStyle: CSSProperties = {
  gridTemplateColumns: PRICE_BOARD_GRID_COLS,
};

export function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function formatPrice(n: number): string {
  // Giá lưu theo VND; UI bảng giá hiển thị theo đơn vị x1000 (19.55 <=> 19,550đ).
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n / 1000);
}

export type PriceTone = 'ceil' | 'floor' | 'up' | 'down' | 'ref';

export function toneFromPrice(p: number, ref: number, ceil: number, floor: number): PriceTone {
  if (p === ceil) return 'ceil';
  if (p === floor) return 'floor';
  if (p > ref) return 'up';
  if (p < ref) return 'down';
  return 'ref';
}

export function chgTone(chg: number): 'up' | 'down' | 'muted' {
  if (chg > 0) return 'up';
  if (chg < 0) return 'down';
  return 'muted';
}
