import { memo, useEffect, useRef } from 'react';
import type { PriceTone } from './price-board-utils';

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
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  tone?: BoardCellTone;
  /** Giá trị dùng để so sánh trước/sau, đổi thì cell sẽ flash. */
  rawValue?: number | string;
  flashStyle?: 'delta' | 'neutral';
  className?: string;
};

export const PriceBoardCell = memo(function PriceBoardCell({
  children,
  align = 'right',
  tone,
  rawValue,
  flashStyle = 'delta',
  className = '',
}: PriceBoardCellProps) {
  const cellRef = useRef<HTMLDivElement | null>(null);
  const prevValueRef = useRef<number | string | undefined>(rawValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const node = cellRef.current;
    if (!node) return;

    const prev = prevValueRef.current;
    if (prev === undefined) {
      prevValueRef.current = rawValue;
      return;
    }
    if (rawValue === undefined || rawValue === prev) return;

    // Flash theo biến động trước/sau của chính cell.
    const nextFlashClass =
      flashStyle === 'neutral'
        ? 'price-board-flash-neutral'
        : typeof rawValue === 'number' && typeof prev === 'number'
          ? rawValue >= prev
            ? 'price-board-flash-up'
            : 'price-board-flash-down'
          : 'price-board-flash-up';

    // Update liên tục vẫn restart được flash + timer chuẩn.
    if (timerRef.current) clearTimeout(timerRef.current);
    node.classList.remove(
      'price-board-flash-up',
      'price-board-flash-down',
      'price-board-flash-neutral',
      'price-board-flash-text',
    );
    void node.offsetWidth; // force reflow để animation restart
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
      className={`flex h-7 min-h-7 items-center border-r border-b border-border/80 bg-background px-1 py-0.5 text-[12px] tabular-nums group-hover/row:bg-border last:border-r-0 ${alignCls} ${toneCls} ${className}`.trim()}
    >
      {children}
    </div>
  );
});
