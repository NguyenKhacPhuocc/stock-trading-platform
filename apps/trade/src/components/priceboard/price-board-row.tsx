import { memo } from 'react';
import { PinIcon } from 'lucide-react';
import { useSelector, shallowEqual } from 'react-redux';
import type { RootState } from '@/store/index';
import { PriceBoardCell } from './price-board-cell';
import { usePriceBoardHighlighted } from './price-board-highlight-context';
import {
  chgTone,
  priceBoardGridStyle,
  toneFromPrice,
  type PriceTone,
} from './price-board-utils';

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

type CornerKey = 'bid3' | 'bid2' | 'bid1' | 'ask1' | 'ask2' | 'ask3';

function selectCorner(symbol: string, key: CornerKey) {
  return (s: RootState) => s.market.entities[symbol]?.[key];
}

function selectMatch(symbol: string) {
  return (s: RootState) => s.market.entities[symbol]?.match;
}

function selectRefBand(symbol: string) {
  return (s: RootState) => {
    const r = s.market.entities[symbol];
    if (!r) return null;
    return { ref: r.ref, ceil: r.ceil, floor: r.floor };
  };
}

function selectMeta(symbol: string) {
  return (s: RootState) => {
    const r = s.market.entities[symbol];
    if (!r) return null;
    return { symbol: r.symbol, exchange: r.exchange };
  };
}

function selectSession(symbol: string) {
  return (s: RootState) => {
    const r = s.market.entities[symbol];
    if (!r) return null;
    return { totalVol: r.totalVol, high: r.high, low: r.low, matchP: r.match.p };
  };
}

function CornerCells({
  symbol,
  side,
}: {
  symbol: string;
  side: 'bid' | 'ask';
}) {
  const keys: CornerKey[] =
    side === 'bid' ? ['bid3', 'bid2', 'bid1'] : ['ask1', 'ask2', 'ask3'];

  return (
    <>
      {keys.map((key) => (
        <CornerCell key={key} symbol={symbol} cornerKey={key} />
      ))}
    </>
  );
}

function CornerCell({
  symbol,
  cornerKey,
}: {
  symbol: string;
  cornerKey: CornerKey;
}) {
  const band = useSelector(selectRefBand(symbol), shallowEqual);
  const corner = useSelector(selectCorner(symbol, cornerKey), shallowEqual);
  const refPx = band?.ref ?? 0;
  const ceil = band?.ceil ?? 0;
  const floor = band?.floor ?? 0;
  const p = corner?.p ?? 0;
  const v = corner?.v ?? 0;
  const tone = toneFromPrice(p, refPx, ceil, floor);
  return (
    <>
      <PriceBoardCell tone={tone} rawValue={p} format="price" />
      <PriceBoardCell tone={tone} rawValue={v} format="int" />
    </>
  );
}

function SymbolCell({
  symbol,
  isPinned,
  onTogglePin,
}: {
  symbol: string;
  isPinned: boolean;
  onTogglePin: (symbol: string) => void;
}) {
  const meta = useSelector(selectMeta(symbol), shallowEqual);
  const band = useSelector(selectRefBand(symbol), shallowEqual);
  const match = useSelector(selectMatch(symbol), shallowEqual);

  if (!meta || !band) {
    return (
      <div className="sticky left-0 z-10 flex h-7 min-h-7 items-center border-r border-b border-border/80 bg-background px-1 py-0.5" />
    );
  }

  const matchP = match?.p ?? 0;
  const symTone =
    matchP > 0
      ? toneFromPrice(matchP, band.ref, band.ceil, band.floor)
      : 'ref';

  return (
    <div className="sticky left-0 z-10 flex h-7 min-h-7 items-center justify-start border-r border-b border-border/80 bg-background px-1 py-0.5 text-left text-[12px] group-hover/row:bg-border">
      <span className="flex items-center gap-1">
        <PinIcon
          className={`h-4 w-4 shrink-0 cursor-pointer text-muted ${isPinned ? 'rotate-45 text-price-down' : ''}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onTogglePin(symbol);
          }}
          aria-label="Ghim mã — double click"
        />
        <span className={`${toneTextClass(symTone)} font-medium`}>{meta.symbol}</span>
        <span className="text-[10px] text-muted">{meta.exchange}</span>
      </span>
    </div>
  );
}

function MatchCells({ symbol }: { symbol: string }) {
  const band = useSelector(selectRefBand(symbol), shallowEqual);
  const match = useSelector(selectMatch(symbol), shallowEqual);
  const ref = band?.ref ?? 0;
  const ceil = band?.ceil ?? 0;
  const floor = band?.floor ?? 0;
  const p = match?.p ?? 0;
  const v = match?.v ?? 0;
  const priceChange = match?.priceChange ?? 0;
  const priceChangePercent = match?.priceChangePercent ?? 0;
  const matchTone = toneFromPrice(p, ref, ceil, floor);
  return (
    <>
      <PriceBoardCell tone={matchTone} rawValue={p} format="price" />
      <PriceBoardCell tone={matchTone} rawValue={v} format="int" />
      <PriceBoardCell
        tone={chgTone(priceChange)}
        rawValue={priceChange}
        format="changePrice"
      />
      <PriceBoardCell
        tone={chgTone(priceChangePercent)}
        rawValue={priceChangePercent}
        format="pct"
      />
    </>
  );
}

function SessionCells({ symbol }: { symbol: string }) {
  const band = useSelector(selectRefBand(symbol), shallowEqual);
  const session = useSelector(selectSession(symbol), shallowEqual);
  const ref = band?.ref ?? 0;
  const ceil = band?.ceil ?? 0;
  const floor = band?.floor ?? 0;
  const high = session?.high ?? 0;
  const low = session?.low ?? 0;
  const matchP = session?.matchP ?? 0;
  const avg = (high + low + matchP) / 3;
  return (
    <>
      <PriceBoardCell tone="white" rawValue={session?.totalVol ?? 0} format="int" flashStyle="neutral" />
      <PriceBoardCell tone={toneFromPrice(high, ref, ceil, floor)} rawValue={high} format="price" />
      <PriceBoardCell tone={toneFromPrice(avg, ref, ceil, floor)} rawValue={avg} format="price" />
      <PriceBoardCell tone={toneFromPrice(low, ref, ceil, floor)} rawValue={low} format="price" />
    </>
  );
}

export type PriceBoardRowProps = {
  symbol: string;
  isPinned: boolean;
  onTogglePin: (symbol: string) => void;
  showPinnedBandBottom?: boolean;
};

export const PriceBoardRow = memo(
  function PriceBoardRowView({
    symbol,
    isPinned,
    onTogglePin,
    showPinnedBandBottom,
  }: PriceBoardRowProps) {
    const band = useSelector(selectRefBand(symbol), shallowEqual);
    const isHighlighted = usePriceBoardHighlighted(symbol);

    if (!band) {
      return (
        <div
          className={`group/row grid ${showPinnedBandBottom ? 'border-b-2 border-board-pin-band' : ''} ${isHighlighted ? 'price-row-highlight' : ''}`}
          style={priceBoardGridStyle}
        />
      );
    }

    return (
      <div
        className={`group/row grid ${showPinnedBandBottom ? 'border-b-2 border-board-pin-band' : ''} ${isHighlighted ? 'price-row-highlight' : ''}`}
        style={priceBoardGridStyle}
      >
        <SymbolCell symbol={symbol} isPinned={isPinned} onTogglePin={onTogglePin} />
        <PriceBoardCell tone="ceil" rawValue={band.ceil} format="price" />
        <PriceBoardCell tone="floor" rawValue={band.floor} format="price" />
        <PriceBoardCell tone="ref" rawValue={band.ref} format="price" />
        <CornerCells symbol={symbol} side="bid" />
        <MatchCells symbol={symbol} />
        <CornerCells symbol={symbol} side="ask" />
        <SessionCells symbol={symbol} />
      </div>
    );
  },
  (prev, next) =>
    prev.symbol === next.symbol &&
    prev.isPinned === next.isPinned &&
    prev.showPinnedBandBottom === next.showPinnedBandBottom &&
    prev.onTogglePin === next.onTogglePin,
);

PriceBoardRow.displayName = 'PriceBoardRow';
