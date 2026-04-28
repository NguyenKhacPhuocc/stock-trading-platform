import { memo, useId } from 'react';
import { formatInt, formatPrice } from './price-board-utils';

type IndexMock = {
  key: string;
  name: string;
  value: number;
  change: number;
  pct: number;
  vol: number;
  valB: number;
  up: number;
  ref: number;
  down: number;
  dir: 'up' | 'down';
};

const MOCK_INDICES: IndexMock[] = [
  {
    key: 'vn',
    name: 'VN-INDEX',
    value: 1284.62,
    change: 8.41,
    pct: 0.66,
    vol: 54_588_859,
    valB: 1724.68,
    up: 210,
    ref: 95,
    down: 85,
    dir: 'up',
  },
  {
    key: 'vn30',
    name: 'VN30-INDEX',
    value: 1321.08,
    change: -3.12,
    pct: -0.24,
    vol: 41_200_000,
    valB: 1320.5,
    up: 12,
    ref: 8,
    down: 10,
    dir: 'down',
  },
  {
    key: 'hnx',
    name: 'HNX-INDEX',
    value: 248.35,
    change: 1.05,
    pct: 0.42,
    vol: 8_900_000,
    valB: 210.2,
    up: 98,
    ref: 40,
    down: 52,
    dir: 'up',
  },
  {
    key: 'up',
    name: 'UPCOM-INDEX',
    value: 92.18,
    change: -0.08,
    pct: -0.09,
    vol: 3_120_000,
    valB: 45.6,
    up: 40,
    ref: 30,
    down: 60,
    dir: 'down',
  },
];

function MiniSparkline({ up }: { up: boolean }) {
  const gradId = useId().replace(/:/g, '');
  const stroke = up ? 'var(--price-up)' : 'var(--price-down)';
  const d = up
    ? 'M0,28 C12,26 18,22 28,18 38,12 52,10 62,6 76,4 88,2 100,4'
    : 'M0,6 C14,8 22,12 32,16 44,18 54,22 66,24 78,22 90,20 100,26';
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L100,32 L0,32 Z`} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export const PriceBoardOverview = memo(function PriceBoardOverview() {
  return (
    <section
      className="grid w-full flex-none grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-1 rounded bg-board-bg p-1"
      aria-label="Tổng quan thị trường"
    >
      {MOCK_INDICES.map((ix) => (
        <div
          key={ix.key}
          className="flex flex-col overflow-hidden rounded border border-board-card-border bg-board-chart text-[11px] text-white"
        >
          <div className="relative h-[70px] bg-board-chart">
            <MiniSparkline up={ix.dir === 'up'} />
            <div className="absolute right-1 top-1 z-[1] flex gap-1">
              <button
                type="button"
                className="flex rounded bg-white/10 p-0.5 text-white hover:bg-white/20"
                aria-label="Zoom"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>
              <button
                type="button"
                className="flex rounded bg-white/10 p-0.5 text-white hover:bg-white/20"
                aria-label="Đóng"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-0.5 px-1.5 py-1">
            <div className="flex flex-wrap items-baseline justify-center gap-2 rounded bg-board-bg px-1 py-1">
              <span className="text-xs font-medium">{ix.name}</span>
              <span
                className={
                  ix.dir === 'up' ? 'text-price-up' : ix.dir === 'down' ? 'text-price-down' : 'text-price-ref'
                }
              >
                {formatPrice(ix.value)}
              </span>
              <span
                className={
                  ix.dir === 'up' ? 'text-price-up' : ix.dir === 'down' ? 'text-price-down' : 'text-price-ref'
                }
              >
                {ix.change >= 0 ? '▲' : '▼'} {Math.abs(ix.change).toFixed(2)} ({ix.pct.toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-center gap-2.5 text-[11px]">
              <span>{formatInt(ix.vol)} CP</span>
              <span className="text-board-stat-value">{formatPrice(ix.valB)} Tỷ</span>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 text-[10px] text-muted">
              <span className="text-price-up">▲ {ix.up}</span>
              <span className="text-price-ref">■ {ix.ref}</span>
              <span className="text-price-down">▼ {ix.down}</span>
              <span>Mock</span>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
});
