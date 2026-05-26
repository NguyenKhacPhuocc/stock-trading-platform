'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  Banknote,
  Eye,
  EyeOff,
  PieChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { PortfolioOverview } from '@/hooks/use-portfolio-overview';
import {
  displayBalanceText,
  formatPercent,
  pnlColorClass,
} from '@/lib/portfolio-format';
import { VndAmount } from '@/components/portfolio/vnd-amount';

type PortfolioSummaryPanelProps = {
  data: PortfolioOverview;
  accountIdLabel: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

function StatTile({
  label,
  valueAmount,
  subPrefix,
  subAmount,
  subText,
  icon: Icon,
  hidden,
  accent = 'primary',
}: {
  label: string;
  valueAmount: number;
  subPrefix?: string;
  subAmount?: number;
  subText?: string;
  icon: LucideIcon;
  hidden: boolean;
  accent?: 'primary' | 'amber' | 'slate';
}) {
  const accentBar =
    accent === 'amber'
      ? 'from-amber-500/60'
      : accent === 'slate'
        ? 'from-slate-400/50'
        : 'from-primary/70';
  const iconBg =
    accent === 'amber'
      ? 'bg-amber-500/10 text-amber-400 ring-amber-500/25'
      : accent === 'slate'
        ? 'bg-white/[0.04] text-muted ring-white/10'
        : 'bg-primary/10 text-primary ring-primary/25';

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-surface/70 p-4 transition-[border-color,transform] duration-200 hover:-translate-y-px hover:border-white/[0.12]">
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentBar} via-transparent to-transparent`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${iconBg}`}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
      </div>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted/90">
        {label}
      </p>
      <p className="mt-1.5">
        <VndAmount amount={valueAmount} hidden={hidden} />
      </p>
      {subPrefix && subAmount != null ? (
        <p className="mt-1.5 text-[11px] text-muted/80">
          {subPrefix}{' '}
          <VndAmount amount={subAmount} hidden={hidden} size="xs" />
        </p>
      ) : subText ? (
        <p className="mt-1.5 text-[11px] text-muted/80">{subText}</p>
      ) : null}
    </div>
  );
}

function PnlMetric({
  label,
  amount,
  percent,
  hidden,
}: {
  label: string;
  amount: number;
  percent: number;
  hidden: boolean;
}) {
  const up = amount > 0;
  const down = amount < 0;
  const cls = pnlColorClass(amount);
  const TrendIcon = up ? TrendingUp : down ? TrendingDown : PieChart;
  const tint = up
    ? 'bg-price-up/[0.08] ring-price-up/20'
    : down
      ? 'bg-price-down/[0.08] ring-price-down/20'
      : 'bg-white/[0.03] ring-white/[0.08]';

  return (
    <div
      className={`min-w-0 flex-1 rounded-xl px-3.5 py-3 ring-1 ${tint}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
        <TrendIcon size={12} className={hidden ? 'text-muted' : cls} />
        {label}
      </div>
      <p className={`mt-2 ${hidden ? 'text-muted/75' : cls}`}>
        <VndAmount amount={amount} signed hidden={hidden} size="lg" className={cls} />
      </p>
      <p className={`mt-0.5 text-sm tabular-nums ${hidden ? 'text-muted/60' : cls}`}>
        {displayBalanceText(formatPercent(percent), hidden)}
      </p>
    </div>
  );
}

function AllocationLegendItem({
  label,
  hint,
  percent,
  amount,
  accentBar,
  percentClass,
  hidden,
}: {
  label: string;
  hint: string;
  percent: number;
  amount: number;
  accentBar: string;
  percentClass?: string;
  hidden: boolean;
}) {
  const pctText = `${percent.toFixed(0)}%`;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <div className="flex items-stretch gap-3">
        <span className={`w-1 shrink-0 rounded-full ${accentBar}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold leading-tight text-foreground">{label}</p>
              <p className="mt-0.5 text-[10px] text-muted">{hint}</p>
            </div>
            <span
              className={`shrink-0 text-lg font-bold tabular-nums leading-none ${hidden ? 'text-muted' : percentClass ?? 'text-foreground'
                }`}
            >
              {displayBalanceText(pctText, hidden)}
            </span>
          </div>
          <p
            className={`mt-2 border-t border-white/[0.06] pt-2 ${hidden ? 'text-muted/70' : 'text-foreground/90'}`}
          >
            <VndAmount amount={amount} hidden={hidden} size="sm" />
          </p>
        </div>
      </div>
    </div>
  );
}

function AllocationRing({
  stockPct,
  cashPct,
  stockAmount,
  cashAmount,
  hidden,
}: {
  stockPct: number;
  cashPct: number;
  stockAmount: number;
  cashAmount: number;
  hidden: boolean;
}) {
  const stockText = `${stockPct.toFixed(0)}%`;
  const cashText = `${cashPct.toFixed(0)}%`;
  return (
    <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-center md:justify-center md:gap-8 lg:gap-10">
      <div className="relative shrink-0">
        <div
          className="h-[10.5rem] w-[10.5rem] rounded-full p-5 md:h-[14rem] md:w-[14rem] md:p-7 lg:h-[16rem] lg:w-[16rem] lg:p-8"
          style={{
            background: `conic-gradient(var(--primary) 0% ${stockPct}%, rgba(148,163,184,0.35) ${stockPct}% 100%)`,
          }}
          role="img"
          aria-label={`Cơ cấu: chứng khoán ${stockText}, tiền mặt ${cashText}`}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-background text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted md:text-xs">
              CP
            </span>
            <span
              className={`text-2xl font-bold tabular-nums md:text-3xl lg:text-4xl ${hidden ? 'text-muted' : 'text-primary'
                }`}
            >
              {displayBalanceText(stockText, hidden)}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0 md:max-w-[15rem] md:flex-1 lg:max-w-[17rem]">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
          Phân bổ tài sản
        </p>
        <div className="mb-1 flex justify-between text-[10px] tabular-nums text-muted">
          <span className={hidden ? '' : 'text-primary'}>
            CP {displayBalanceText(stockText, hidden)}
          </span>
          <span>Tiền {displayBalanceText(cashText, hidden)}</span>
        </div>
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuenow={stockPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Thanh phân bổ chứng khoán và tiền mặt"
        >
          <div
            className="bg-primary transition-[width] duration-500"
            style={{ width: `${stockPct}%` }}
          />
          <div
            className="bg-slate-500/45 transition-[width] duration-500"
            style={{ width: `${cashPct}%` }}
          />
        </div>
        <p className="mt-1.5 mb-3 text-[10px] text-muted/80">Tỷ lệ % tính trên tổng NAV</p>

        <div className="space-y-2">
          <AllocationLegendItem
            label="Chứng khoán"
            hint="Giá trị thị trường danh mục"
            percent={stockPct}
            amount={stockAmount}
            accentBar="bg-primary"
            percentClass="text-primary"
            hidden={hidden}
          />
          <AllocationLegendItem
            label="Tiền mặt"
            hint="Tổng số dư tiền trên TK"
            percent={cashPct}
            amount={cashAmount}
            accentBar="bg-slate-400/70"
            hidden={hidden}
          />
        </div>
      </div>
    </div>
  );
}

export function PortfolioSummaryPanel({
  data,
  accountIdLabel,
  onRefresh,
  isRefreshing = false,
}: PortfolioSummaryPanelProps) {
  const [hideBalances, setHideBalances] = useState(false);
  const { cash, summary } = data;

  const allocation = useMemo(() => {
    const nav = summary.nav > 0 ? summary.nav : 1;
    const stockPct = Math.min(100, Math.max(0, (summary.totalMarketValue / nav) * 100));
    const cashPct = Math.min(100, Math.max(0, 100 - stockPct));
    return { stockPct, cashPct };
  }, [summary.nav, summary.totalMarketValue]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>

          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Tổng hợp tài sản
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <code className="rounded-lg border border-white/[0.08] bg-black/25 px-2 py-0.5 font-mono text-[11px] text-foreground/90">
              {accountIdLabel}
            </code>
            <span className="text-white/20">|</span>
            <span>
              {summary.positionCount > 0
                ? `${summary.positionCount} mã đang nắm`
                : 'Chưa có vị thế'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/20 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <button
            type="button"
            onClick={() => setHideBalances((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
            aria-pressed={hideBalances}
          >
            {hideBalances ? <Eye size={15} /> : <EyeOff size={15} />}
            {hideBalances ? 'Hiện số' : 'Ẩn số'}
          </button>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-lg p-2 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-40"
              aria-label="Làm mới"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          ) : null}
          <Link
            href="/account/holdings"
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            Danh mục
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/60">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 50% at 100% 0%, rgba(33,206,60,0.12), transparent),
              radial-gradient(ellipse 60% 40% at 0% 100%, rgba(33,206,60,0.04), transparent)
            `,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="relative grid gap-6 p-5 sm:p-6 md:grid-cols-2 md:gap-0">
          <div className="space-y-5 md:pr-6 lg:pr-8">
            <div>
              <p className="text-[20px] font-bold text-primary uppercase text-muted">
                Tổng tài sản (NAV)
              </p>
              <p className="mt-2">
                <VndAmount amount={summary.nav} hidden={hideBalances} size="hero" />
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <PnlMetric
                label="Lãi/lỗ chưa TH"
                amount={summary.unrealizedPnL}
                percent={summary.unrealizedPnLPercent}
                hidden={hideBalances}
              />
              <PnlMetric
                label="Lãi/lỗ trong ngày"
                amount={summary.dayPnL}
                percent={summary.dayPnLPercent}
                hidden={hideBalances}
              />
            </div>
          </div>

          <div className="flex min-h-[17rem] flex-col justify-center rounded-xl border border-white/[0.06] bg-black/20 px-4 md:min-h-[18rem] md:rounded-none md:border-0 md:border-l md:border-white/[0.06] md:bg-transparent md:pl-6 md:pr-2 lg:min-h-[20rem] lg:pl-8">
            <p className="mb-4 text-[20px] font-bold text-primary uppercase text-muted md:mb-5">
              Cơ cấu tài sản
            </p>
            <AllocationRing
              stockPct={allocation.stockPct}
              cashPct={allocation.cashPct}
              stockAmount={summary.totalMarketValue}
              cashAmount={cash.total}
              hidden={hideBalances}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Tiền khả dụng"
          icon={Wallet}
          hidden={hideBalances}
          accent="primary"
          valueAmount={cash.available}
          subPrefix={cash.locked > 0 ? 'Phong tỏa' : undefined}
          subAmount={cash.locked > 0 ? cash.locked : undefined}
        />
        <StatTile
          label="Giá trị chứng khoán"
          icon={PieChart}
          hidden={hideBalances}
          accent="amber"
          valueAmount={summary.totalMarketValue}
          subPrefix="Vốn gốc"
          subAmount={summary.totalCostBasis}
        />
        <StatTile
          label="Tổng tiền mặt"
          icon={Banknote}
          hidden={hideBalances}
          accent="slate"
          valueAmount={cash.total}
          subText="Khả dụng + phong tỏa"
        />
      </div>
    </div>
  );
}
