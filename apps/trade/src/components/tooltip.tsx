'use client';

import { Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TooltipSide = 'top' | 'bottom';
type TooltipAlign = 'left' | 'center' | 'right';

interface TooltipProps {
  text: string;
  side?: TooltipSide;
  align?: TooltipAlign;
}

interface TooltipPos {
  top: number;
  left: number;
  arrowLeft: number;
}

const MAX_WIDTH = 300;
const GAP = 8;
const ARROW_SIZE = 5;
const SCREEN_MARGIN = 8;

function calcPos(
  iconRect: DOMRect,
  boxRect: DOMRect,
  side: TooltipSide,
  align: TooltipAlign,
): TooltipPos {
  const iconCenterX = iconRect.left + iconRect.width / 2;
  const boxW = boxRect.width;
  const boxH = boxRect.height;

  let left: number;
  if (align === 'left') {
    left = iconRect.left;
  } else if (align === 'right') {
    // Căn phải: cạnh phải box = cạnh phải icon
    left = iconRect.right - boxW;
  } else {
    // Căn giữa icon
    left = iconCenterX - boxW / 2;
  }

  // Clamp không tràn màn hình
  left = Math.max(SCREEN_MARGIN, Math.min(left, window.innerWidth - boxW - SCREEN_MARGIN));

  // Mũi tên luôn trỏ vào tâm icon
  const arrowLeft = iconCenterX - left - ARROW_SIZE;

  const top =
    side === 'top'
      ? iconRect.top - boxH - GAP
      : iconRect.bottom + GAP;

  return { top, left, arrowLeft };
}

export function Tooltip({ text, side = 'top', align = 'center' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);

  // Tính vị trí sau khi cả icon lẫn box đã render
  useEffect(() => {
    if (!visible || !iconRef.current || !boxRef.current) return;

    const iconRect = iconRef.current.getBoundingClientRect();
    const boxRect = boxRef.current.getBoundingClientRect();
    setPos(calcPos(iconRect, boxRect, side, align));
  }, [visible, side, align]);

  // Placeholder top để box render (không hiển thị, chỉ để đo kích thước)
  const hiddenStyle: React.CSSProperties = {
    position: 'fixed',
    top: -9999,
    left: -9999,
    maxWidth: MAX_WIDTH,
    width: 'max-content',
    visibility: 'hidden',
    pointerEvents: 'none',
    zIndex: -1,
  };

  const visibleStyle: React.CSSProperties = pos
    ? {
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      maxWidth: MAX_WIDTH,
      width: 'max-content',
      zIndex: 9999,
      pointerEvents: 'none',
    }
    : hiddenStyle;

  const tooltip = visible ? (
    <span style={visibleStyle}>
      <span
        ref={boxRef}
        style={{
          display: 'block',
          background: '#374151',
          color: '#f9fafb',
          fontSize: 12,
          lineHeight: 1.5,
          padding: '5px 9px',
          borderRadius: 4,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </span>
      {pos && (
        <span
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            left: pos.arrowLeft,
            ...(side === 'top'
              ? {
                bottom: -ARROW_SIZE,
                borderLeft: `${ARROW_SIZE}px solid transparent`,
                borderRight: `${ARROW_SIZE}px solid transparent`,
                borderTop: `${ARROW_SIZE}px solid #374151`,
              }
              : {
                top: -ARROW_SIZE,
                borderLeft: `${ARROW_SIZE}px solid transparent`,
                borderRight: `${ARROW_SIZE}px solid transparent`,
                borderBottom: `${ARROW_SIZE}px solid #374151`,
              }),
          }}
        />
      )}
    </span>
  ) : null;

  return (
    <span
      ref={iconRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => { setVisible(false); setPos(null); }}
    >
      <Info className="cursor-pointer" size={13} style={{ color: 'var(--muted)' }} />
      {typeof window !== 'undefined' && createPortal(tooltip, document.body)}
    </span>
  );
}
