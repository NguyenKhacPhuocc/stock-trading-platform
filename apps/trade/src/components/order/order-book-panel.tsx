'use client';

import { useMemo, useState } from 'react';

export type OrderBookLevel = {
  price: number;
  amount: number;
};

/** Tab Tổng hợp: mỗi side 10 mốc; tab chỉ Mua / chỉ Bán: 20 mốc một phía. */
const VISIBLE_LEVELS_COMBINED = 10;
const VISIBLE_LEVELS_SINGLE_SIDE = 20;

/** Cột Giá tách ô; KL+Tổng gộp — depth chỉ trong ô gộp, neo mép phải của ô đó. */
const BOOK_ROW_OUTER_CLASS =
  'grid items-center gap-x-2 px-2 [grid-template-columns:minmax(3.75rem,min(42%,10rem))_minmax(0,1fr)]';
/** Lưới con KL/Tổng — cùng cấu trúc với từng hàng để cột không lệch. */
const BOOK_QTY_TOTAL_INNER_CLASS =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 tabular-nums';

/** Snapshot cứng cho UI — chỉ dùng khi chưa truyền asks/bids từ props. */
const MOCK_LAST_PRICE = 41.45;

const FALLBACK_BOOK_ASKS: OrderBookLevel[] = [
  { price: 41.52, amount: 120 },
  { price: 41.54, amount: 85 },
  { price: 41.56, amount: 200 },
  { price: 41.58, amount: 64 },
  { price: 41.61, amount: 150 },
  { price: 41.63, amount: 90 },
  { price: 41.66, amount: 110 },
  { price: 41.69, amount: 75 },
  { price: 41.72, amount: 88 },
  { price: 41.75, amount: 102 },
  { price: 41.78, amount: 78 },
  { price: 41.81, amount: 130 },
  { price: 41.84, amount: 66 },
  { price: 41.87, amount: 94 },
  { price: 41.9, amount: 112 },
  { price: 41.93, amount: 58 },
  { price: 41.96, amount: 140 },
  { price: 41.99, amount: 82 },
  { price: 42.02, amount: 71 },
  { price: 42.05, amount: 99 },
];

const FALLBACK_BOOK_BIDS: OrderBookLevel[] = [
  { price: 41.44, amount: 95 },
  { price: 41.41, amount: 180 },
  { price: 41.38, amount: 55 },
  { price: 41.36, amount: 140 },
  { price: 41.33, amount: 70 },
  { price: 41.3, amount: 200 },
  { price: 41.27, amount: 45 },
  { price: 41.24, amount: 120 },
  { price: 41.21, amount: 160 },
  { price: 41.18, amount: 92 },
  { price: 41.15, amount: 105 },
  { price: 41.12, amount: 68 },
  { price: 41.09, amount: 188 },
  { price: 41.06, amount: 52 },
  { price: 41.03, amount: 122 },
  { price: 41.0, amount: 76 },
  { price: 40.97, amount: 134 },
  { price: 40.94, amount: 98 },
  { price: 40.91, amount: 61 },
  { price: 40.88, amount: 145 },
];

/** Lấy các mức sát spread nhất trước khi render depth. */
function nearestVisibleLevels(side: 'sell' | 'buy', levels: OrderBookLevel[], maxRows: number) {
  if (levels.length <= maxRows) return levels;
  const sorted =
    side === 'sell'
      ? [...levels].sort((a, b) => a.price - b.price)
      : [...levels].sort((a, b) => b.price - a.price);
  return sorted.slice(0, maxRows);
}

type BookView = 'both' | 'buy' | 'sell';

type OrderBookPanelProps = {
  panelCardClassName: string;
  /** Bên bán (asks): trên cao là giá chào cao, xuống gần giữa là giá chào thấp nhất (sát spread). */
  asks?: OrderBookLevel[];
  /** Bên mua (bids): ngay dưới khối giữa là giá mua cao nhất; xuống dưới là giá mua thấp dần. */
  bids?: OrderBookLevel[];
  lastPrice?: number | null;
  /** Xu hướng so với phiên trước / tham chiếu — chỉ để đổi màu mũi tên */
  lastDirection?: 'up' | 'down' | 'flat';
};

function formatQty(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 4 });
}

function formatPrice(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPctUi(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTotalK(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Cột Tổng trên UI = KL * Giá (nghìn đồng).
 * Độ rộng thanh depth vẫn theo cumulative depth chuẩn:
 * width[i] = (cum[i] / max_cum) × 100%.
 */
function withDepthLevels(levels: OrderBookLevel[], side: 'sell' | 'buy') {
  if (levels.length === 0) return [] as Array<OrderBookLevel & { depthPct: number; cumAmount: number }>;

  const sorted =
    side === 'sell'
      ? [...levels].sort((a, b) => a.price - b.price)
      : [...levels].sort((a, b) => b.price - a.price);

  const cumAmount: number[] = [];
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].amount;
    cumAmount[i] = sum;
  }

  const maxCum = cumAmount[cumAmount.length - 1] ?? 1e-9;
  const lastIdx = sorted.length - 1;

  const rows = sorted.map((row, i) => ({
    ...row,
    cumAmount: cumAmount[i],
    /** Hàng có cum = max_cum luôn 100% UI (tránh lệch float). */
    depthPct: i === lastIdx ? 100 : Math.min(100, (cumAmount[i] / maxCum) * 100),
  }));

  return side === 'sell' ? rows.reverse() : rows;
}

function OrderBookToolbar({
  view,
  onViewChange,
}: {
  view: BookView;
  onViewChange: (v: BookView) => void;
}) {
  const btn =
    'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-border';
  const active = 'bg-surface-2 text-foreground ring-1 ring-border/80';
  const idle = 'text-muted hover:bg-white/[0.04] hover:text-foreground';

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/80 px-2 py-1">
      <span className="text-[11px] font-semibold tracking-tight text-foreground">Sổ lệnh</span>
      <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-black/20 p-px">
        <button
          type="button"
          title="Tổng hợp hai phía — mỗi phía 10 mốc"
          className={`${btn} max-w-[5.5rem] truncate px-1 ${view === 'both' ? active : idle}`}
          onClick={() => onViewChange('both')}
        >
          Tổng hợp
        </button>
        <button
          type="button"
          title="Chỉ sổ bán — tối đa 20 mức giá"
          className={`${btn} ${view === 'sell' ? active : idle}`}
          onClick={() => onViewChange('sell')}
        >
          Bán
        </button>
        <button
          type="button"
          title="Chỉ sổ mua — tối đa 20 mức giá"
          className={`${btn} ${view === 'buy' ? active : idle}`}
          onClick={() => onViewChange('buy')}
        >
          Mua
        </button>
      </div>
    </div>
  );
}

function ColumnHeaders() {
  return (
    <div
      className={`${BOOK_ROW_OUTER_CLASS} border-b border-border/60 py-0.5 text-[10px] font-medium tracking-wide text-muted`}
    >
      <span className="select-none text-start tabular-nums">Giá</span>
      <div className={BOOK_QTY_TOTAL_INNER_CLASS}>
        <span className="whitespace-nowrap text-center">Số lượng</span>
        <span className="whitespace-nowrap text-end">Tổng</span>
      </div>
    </div>
  );
}

function DepthRow(props: {
  side: 'sell' | 'buy';
  qty: number;
  price: number;
  depthPct: number;
  /** Trong lưới chia đều: ví dụ `h-full min-h-0` */
  className?: string;
}) {
  const { side, qty, price, depthPct, className = '' } = props;
  const priceCls = side === 'sell' ? 'text-price-down' : 'text-price-up';
  const totalK = qty * price;

  /**
   * depthPct = cum/max_cum (0–100), neo phải toàn hàng (trừ px-2).
   * Chiều cao hàng: py + font-size + leading — không cố định pixel cố định.
   */
  const barTint = side === 'sell' ? 'bg-price-down/[0.09]' : 'bg-price-up/[0.09]';
  const w = Math.min(100, Math.max(0, depthPct));

  return (
    <div
      className={`${BOOK_ROW_OUTER_CLASS} relative isolate py-px font-mono text-[11px] leading-none tracking-tight hover:bg-white/[0.03] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-2 right-2 z-0 overflow-hidden rounded-[2px]"
        aria-hidden
      >
        <div className={`absolute inset-y-0 right-0 ${barTint}`} style={{ width: `${w}%` }} />
      </div>

      <span
        className={`relative z-[1] min-w-0 whitespace-nowrap text-start font-normal tabular-nums ${priceCls}`}
        title='đơn vị nghìn đồng'
      >
        {formatPrice(price)}
      </span>

      <div className="relative z-[1] min-h-0 min-w-0">
        <div className={`min-h-0 ${BOOK_QTY_TOTAL_INNER_CLASS} text-muted`}>
          <span className="min-w-0 whitespace-nowrap text-center">{formatQty(qty)}</span>
          <span className="min-w-0 whitespace-nowrap text-end">{formatTotalK(totalK)}</span>
        </div>
      </div>
    </div>
  );
}

/** Một dòng kiểu Binance: `B xx% —[thanh]— xx% S` */
function RatioBar(props: {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}) {
  const { bids, asks } = props;
  const { buyPct, sellPct } = useMemo(() => {
    const bv = bids.reduce((s, r) => s + r.amount, 0);
    const av = asks.reduce((s, r) => s + r.amount, 0);
    const t = bv + av;
    if (t <= 0) return { buyPct: 50, sellPct: 50 };
    return {
      buyPct: (bv / t) * 100,
      sellPct: (av / t) * 100,
    };
  }, [asks, bids]);

  const bStr = formatPctUi(buyPct);
  const sStr = formatPctUi(sellPct);

  return (
    <div className="flex w-full min-w-0 items-center gap-2 px-2 py-1 font-mono text-[10px] tabular-nums leading-none tracking-tight">
      <span className="shrink-0 text-price-up" title="Tỷ trọng khối lượng mua (bid)">
        B {bStr}%
      </span>
      <div
        className="flex h-1 min-h-0 min-w-[3rem] flex-1 overflow-hidden rounded-sm bg-black/40"
        role="img"
        aria-label={`Tỷ lệ mua ${bStr}% — bán ${sStr}%`}
      >
        <div className="h-full shrink-0 bg-price-up/90" style={{ width: `${buyPct}%` }} />
        <div className="h-full shrink-0 bg-price-down/90" style={{ width: `${sellPct}%` }} />
      </div>
      <span className="shrink-0 text-price-down" title="Tỷ trọng khối lượng bán (ask)">
        {sStr}% S
      </span>
    </div>
  );
}

function LastTradeRow(props: {
  price: number | null | undefined;
  direction?: 'up' | 'down' | 'flat';
}) {
  const { price, direction = 'flat' } = props;
  const has = price != null && Number.isFinite(price);
  const color =
    direction === 'up'
      ? 'text-price-up'
      : direction === 'down'
        ? 'text-price-down'
        : 'text-muted-foreground';
  const arrow =
    direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';

  return (
    <div className={`flex shrink-0 items-center justify-center border-y border-border/60 bg-black/25 px-2 py-0.5 font-mono text-sm font-semibold leading-none tabular-nums ${color}`}>
      <span className="flex items-center gap-1 tracking-tight">
        {has ? formatPrice(price as number) : '—'}
        {has && arrow ? <span className="translate-y-px text-[10px] opacity-95">{arrow}</span> : null}
      </span>
    </div>
  );
}

export function OrderBookPanel({
  panelCardClassName,
  asks = [],
  bids = [],
  lastPrice,
  lastDirection = 'flat',
}: OrderBookPanelProps) {
  const [view, setView] = useState<BookView>('both');

  /** Chỉ lấy dữ liệu cứng khi hai phía chưa truyền — tránh lẫn API một bên có / một bên không. */
  const useFallbackDemo = asks.length === 0 && bids.length === 0;
  const sourceAsks = useFallbackDemo ? FALLBACK_BOOK_ASKS : asks;
  const sourceBids = useFallbackDemo ? FALLBACK_BOOK_BIDS : bids;

  const levelsCap = view === 'both' ? VISIBLE_LEVELS_COMBINED : VISIBLE_LEVELS_SINGLE_SIDE;

  const visibleAsks = useMemo(
    () => nearestVisibleLevels('sell', sourceAsks, levelsCap),
    [sourceAsks, levelsCap],
  );
  const visibleBids = useMemo(
    () => nearestVisibleLevels('buy', sourceBids, levelsCap),
    [sourceBids, levelsCap],
  );

  const askRows = useMemo(() => withDepthLevels(visibleAsks, 'sell'), [visibleAsks]);

  const bidRows = useMemo(() => withDepthLevels(visibleBids, 'buy'), [visibleBids]);

  const displayLastPrice = lastPrice ?? (useFallbackDemo ? MOCK_LAST_PRICE : undefined);
  const displayDirection: 'up' | 'down' | 'flat' = useFallbackDemo ? 'down' : lastDirection;

  const showAsks = view === 'both' || view === 'sell';
  const showBids = view === 'both' || view === 'buy';

  /** Tỉ lệ trên snapshot đang hiển thị (theo tab Tổng hợp / Mua / Bán). */
  const ratioAskLevels = showAsks ? visibleAsks : [];
  const ratioBidLevels = showBids ? visibleBids : [];

  const askFlexClass =
    view === 'both'
      ? 'min-h-0 flex-[45]'
      : view === 'sell'
        ? 'min-h-0 flex-[90]'
        : 'min-h-0 flex-none h-0 overflow-hidden opacity-0 pointer-events-none';
  const bidFlexClass =
    view === 'both'
      ? 'min-h-0 flex-[45]'
      : view === 'buy'
        ? 'min-h-0 flex-[90]'
        : 'min-h-0 flex-none h-0 overflow-hidden opacity-0 pointer-events-none';

  return (
    <section className={`${panelCardClassName} flex min-h-[280px] flex-col overflow-hidden`}>
      <OrderBookToolbar view={view} onViewChange={setView} />
      <ColumnHeaders />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden leading-none">
        {/* Bên bán — chia đều với bên mua; không dùng flex % cao ô giữa để khỏi “trống giả” */}
        <div className={`${askFlexClass} flex flex-col overflow-hidden`}>
          {!showAsks || askRows.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center py-6 text-[10px] text-muted px-2 text-center leading-snug">
              {!showAsks ? '' : 'Không có dữ liệu bên bán'}
            </div>
          ) : (
            <div
              className="min-h-0 flex-1 grid gap-y-[1px] overflow-hidden py-[2px]"
              style={{
                gridTemplateRows: `repeat(${askRows.length}, minmax(0, 1fr))`,
              }}
            >
              {askRows.map((r, i) => (
                <DepthRow
                  key={`ask-${r.price}-${i}`}
                  className="h-full min-h-0"
                  side="sell"
                  qty={r.amount}
                  price={r.price}
                  depthPct={r.depthPct}
                />
              ))}
            </div>
          )}
        </div>

        {/* Giá khớp — cao cố định gọn */}
        <div className="shrink-0">
          <LastTradeRow price={displayLastPrice} direction={displayDirection} />
        </div>

        {/* Bên mua — 45% */}
        <div className={`${bidFlexClass} flex flex-col overflow-hidden`}>
          {!showBids || bidRows.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center py-6 text-[10px] text-muted px-2 text-center leading-snug">
              {!showBids ? '' : 'Không có dữ liệu bên mua'}
            </div>
          ) : (
            <div
              className="min-h-0 flex-1 grid gap-y-[1px] overflow-hidden py-[2px]"
              style={{
                gridTemplateRows: `repeat(${bidRows.length}, minmax(0, 1fr))`,
              }}
            >
              {bidRows.map((r, i) => (
                <DepthRow
                  key={`bid-${r.price}-${i}`}
                  className="h-full min-h-0"
                  side="buy"
                  qty={r.amount}
                  price={r.price}
                  depthPct={r.depthPct}
                />
              ))}
            </div>
          )}
        </div>

        {/* Thanh tỉ lệ — 1 dòng full width */}
        <div className="shrink-0 border-t border-border/60">
          <RatioBar bids={ratioBidLevels} asks={ratioAskLevels} />
        </div>
      </div>
    </section>
  );
}
