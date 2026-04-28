import { memo } from 'react';
import { PinIcon } from 'lucide-react';
import type { PriceBoardRow as PriceBoardRowData } from './price-board-types';
import { PriceBoardCell } from './price-board-cell';
import { chgTone, formatInt, formatPrice, priceBoardGridStyle, toneFromPrice, type PriceTone } from './price-board-utils';

function toneTextClass(t: PriceTone): string {
  switch (t) {
    case 'up':
      return 'text-price-up';
    case 'down':
      return 'text-price-down';
    case 'ceil':
      return 'text-price-ceil';
    case 'floor':
      return 'text-price-floor';
    default:
      return 'text-price-ref';
  }
}

export type PriceBoardRowProps = {
  row: PriceBoardRowData;
  isPinned: boolean;
  isHighlighted?: boolean;
  onTogglePin: () => void;
  showPinnedBandBottom?: boolean;
};

export const PriceBoardRow = memo(
  function PriceBoardRowView({ row: r, isPinned, isHighlighted = false, onTogglePin, showPinnedBandBottom }: PriceBoardRowProps) {
    const ref = r.ref;
    const ceil = r.ceil;
    const floor = r.floor;
    const symTone = toneFromPrice(r.match.p, ref, ceil, floor);
    const bid3Tone = toneFromPrice(r.bid3.p, ref, ceil, floor);
    const bid2Tone = toneFromPrice(r.bid2.p, ref, ceil, floor);
    const bid1Tone = toneFromPrice(r.bid1.p, ref, ceil, floor);
    const matchTone = toneFromPrice(r.match.p, ref, ceil, floor);
    const ask1Tone = toneFromPrice(r.ask1.p, ref, ceil, floor);
    const ask2Tone = toneFromPrice(r.ask2.p, ref, ceil, floor);
    const ask3Tone = toneFromPrice(r.ask3.p, ref, ceil, floor);
    const avg = (r.high + r.low + r.match.p) / 3;
    const highTone = toneFromPrice(r.high, ref, ceil, floor);
    const avgTone = toneFromPrice(avg, ref, ceil, floor);
    const lowTone = toneFromPrice(r.low, ref, ceil, floor);
    const priceOrEmpty = (value: number) => (value > 0 ? formatPrice(value) : '');
    const intOrEmpty = (value: number) => (value > 0 ? formatInt(value) : '');

    return (
      <div
        className={`group/row grid ${showPinnedBandBottom ? 'border-b-2 border-board-pin-band' : ''} ${isHighlighted ? 'price-row-highlight' : ''}`}
        style={priceBoardGridStyle}
      >
        <PriceBoardCell
          align="left"
          className="sticky left-0 z-10 bg-background"
        >
          <span className="flex items-center gap-1">
            <PinIcon
              className={`h-4 w-4 shrink-0 cursor-pointer text-muted ${isPinned ? 'rotate-45 text-price-down' : ''}`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              aria-label="Ghim mã — double click"
            />
            <span className={toneTextClass(symTone) + " font-medium"}>{r.symbol}</span>
            <span className="text-[10px] text-muted">{r.exchange}</span>
          </span>
        </PriceBoardCell>
        <PriceBoardCell tone="ref" rawValue={r.ref}>{formatPrice(r.ref)}</PriceBoardCell>
        <PriceBoardCell tone="ceil" rawValue={r.ceil}>{formatPrice(r.ceil)}</PriceBoardCell>
        <PriceBoardCell tone="floor" rawValue={r.floor}>{formatPrice(r.floor)}</PriceBoardCell>
        <PriceBoardCell tone={bid3Tone} rawValue={r.bid3.p}>{priceOrEmpty(r.bid3.p)}</PriceBoardCell>
        <PriceBoardCell tone={bid3Tone} rawValue={r.bid3.v}>{intOrEmpty(r.bid3.v)}</PriceBoardCell>
        <PriceBoardCell tone={bid2Tone} rawValue={r.bid2.p}>{priceOrEmpty(r.bid2.p)}</PriceBoardCell>
        <PriceBoardCell tone={bid2Tone} rawValue={r.bid2.v}>{intOrEmpty(r.bid2.v)}</PriceBoardCell>
        <PriceBoardCell tone={bid1Tone} rawValue={r.bid1.p}>{priceOrEmpty(r.bid1.p)}</PriceBoardCell>
        <PriceBoardCell tone={bid1Tone} rawValue={r.bid1.v}>{intOrEmpty(r.bid1.v)}</PriceBoardCell>
        <PriceBoardCell tone={matchTone} rawValue={r.match.p}>
          {priceOrEmpty(r.match.p)}
        </PriceBoardCell>
        <PriceBoardCell tone={matchTone} rawValue={r.match.v}>{intOrEmpty(r.match.v)}</PriceBoardCell>
        <PriceBoardCell tone={chgTone(r.match.priceChange)} rawValue={r.match.priceChange}>
          {r.match.priceChange === 0 ? '' : formatPrice(r.match.priceChange)}
        </PriceBoardCell>
        <PriceBoardCell tone={chgTone(r.match.priceChangePercent)} rawValue={r.match.priceChangePercent}>
          {r.match.priceChangePercent === 0 ? '' : `${r.match.priceChangePercent >= 0 ? '+' : ''}${r.match.priceChangePercent.toFixed(2)}%`}
        </PriceBoardCell>
        <PriceBoardCell tone={ask1Tone} rawValue={r.ask1.p}>{priceOrEmpty(r.ask1.p)}</PriceBoardCell>
        <PriceBoardCell tone={ask1Tone} rawValue={r.ask1.v}>{intOrEmpty(r.ask1.v)}</PriceBoardCell>
        <PriceBoardCell tone={ask2Tone} rawValue={r.ask2.p}>{priceOrEmpty(r.ask2.p)}</PriceBoardCell>
        <PriceBoardCell tone={ask2Tone} rawValue={r.ask2.v}>{intOrEmpty(r.ask2.v)}</PriceBoardCell>
        <PriceBoardCell tone={ask3Tone} rawValue={r.ask3.p}>{priceOrEmpty(r.ask3.p)}</PriceBoardCell>
        <PriceBoardCell tone={ask3Tone} rawValue={r.ask3.v}>{intOrEmpty(r.ask3.v)}</PriceBoardCell>
        <PriceBoardCell tone="white" rawValue={r.totalVol} flashStyle="neutral">
          {intOrEmpty(r.totalVol)}
        </PriceBoardCell>
        <PriceBoardCell tone={highTone} rawValue={r.high}>{priceOrEmpty(r.high)}</PriceBoardCell>
        <PriceBoardCell tone={avgTone} rawValue={avg}>{priceOrEmpty(avg)}</PriceBoardCell>
        <PriceBoardCell tone={lowTone} rawValue={r.low}>{priceOrEmpty(r.low)}</PriceBoardCell>
      </div>
    );
  },
  (prev, next) =>
    prev.row === next.row &&
    prev.isPinned === next.isPinned &&
    prev.isHighlighted === next.isHighlighted &&
    prev.showPinnedBandBottom === next.showPinnedBandBottom,
);

PriceBoardRow.displayName = 'PriceBoardRow';
