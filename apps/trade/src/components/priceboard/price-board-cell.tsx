import { memo, useEffect, useRef } from 'react';
import { formatChangePrice, formatInt, formatPrice, type PriceTone} from './price-board-utils';

export type BoardCellTone = PriceTone | 'muted' | 'white';

const toneClass: Record<BoardCellTone, string> = {
  ceil: 'text-price-ceil',
  floor: 'text-price-floor',
  up: 'text-price-up',
  down: 'text-price-down',
  ref: 'text-price-ref',
  muted: 'text-muted',
  white: 'text-white',
};

export type PriceBoardCellProps = {
  align?: 'left' | 'right' | 'center';
  tone?: BoardCellTone;
  rawValue?: number | string;
  /** Cách format số hiển thị — không truyền children để memo có hiệu lực. */
  format?: 'price' | 'changePrice' | 'int' | 'pct' | 'text';
  flashStyle?: 'delta' | 'neutral';
  className?: string;
};

function formatDisplay(
  rawValue: number | string | undefined,
  format: PriceBoardCellProps['format'],
): string {
  if (rawValue === undefined) return '';
  if (format === 'text') return String(rawValue);
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return '';
  if (format === 'int') return rawValue > 0 ? formatInt(rawValue) : '';
  if (format === 'pct') {
    if (rawValue === 0) return '';
    return `${rawValue >= 0 ? '+' : ''}${rawValue.toFixed(2)}%`;
  }
  if (format === 'changePrice') {
    return typeof rawValue === 'number' ? formatChangePrice(rawValue) : '';
  }
  // Giá mức sổ / khớp: 0 = ô trống
  return rawValue > 0 ? formatPrice(rawValue) : '';
}

function cellPropsEqual(prev: PriceBoardCellProps, next: PriceBoardCellProps): boolean {
  return (
    prev.align === next.align &&
    prev.tone === next.tone &&
    prev.rawValue === next.rawValue &&
    prev.format === next.format &&
    prev.flashStyle === next.flashStyle &&
    prev.className === next.className
  );
}

export const PriceBoardCell = memo(function PriceBoardCell({
  align = 'right',
  tone,
  rawValue,
  format = 'price',
  flashStyle = 'delta',
  className = '',
}: PriceBoardCellProps) {
  const cellRef = useRef<HTMLDivElement | null>(null);
  const prevValueRef = useRef<number | string | undefined>(rawValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const display = formatDisplay(rawValue, format);

  useEffect(() => {
    const node = cellRef.current;
    if (!node) return;

    const prev = prevValueRef.current;
    if (prev === undefined) {
      prevValueRef.current = rawValue;
      return;
    }
    if (rawValue === undefined || rawValue === prev) return;

    const nextFlashClass =
      flashStyle === 'neutral'
        ? 'price-board-flash-neutral'
        : typeof rawValue === 'number' && typeof prev === 'number'
          ? rawValue >= prev
            ? 'price-board-flash-up'
            : 'price-board-flash-down'
          : 'price-board-flash-up';

    if (timerRef.current) clearTimeout(timerRef.current);
    node.classList.remove(
      'price-board-flash-up',
      'price-board-flash-down',
      'price-board-flash-neutral',
      'price-board-flash-text',
    );
    void node.offsetWidth;
    node.classList.add(nextFlashClass, 'price-board-flash-text');
    timerRef.current = setTimeout(() => {
      node.classList.remove(
        'price-board-flash-up',
        'price-board-flash-down',
        'price-board-flash-neutral',
        'price-board-flash-text',
      );
    }, 1000);
    prevValueRef.current = rawValue;
  }, [flashStyle, rawValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const alignCls =
    align === 'left'
      ? 'justify-start text-left'
      : align === 'center'
        ? 'justify-center text-center'
        : 'justify-end text-right';

  const toneCls = tone ? toneClass[tone] : '';

  return (
    <div
      ref={cellRef}
      className={`flex h-7 min-h-7 items-center border-r border-b border-border/80 bg-background px-1 py-0.5 text-sm tabular-nums group-hover/row:bg-border last:border-r-0 ${alignCls} ${toneCls} ${className}`.trim()}
    >
      {display}
    </div>
  );
}, cellPropsEqual);
