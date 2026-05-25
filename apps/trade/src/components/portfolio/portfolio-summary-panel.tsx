import type { PortfolioOverview } from '@/hooks/use-portfolio-overview';
import {
  formatPercent,
  formatSignedVnd,
  formatVnd,
  pnlColorClass,
} from '@/lib/portfolio-format';

type PortfolioSummaryPanelProps = {
  data: PortfolioOverview;
  accountIdLabel: string;
};

function SummaryCard({
  label,
  value,
  sub,
  valueClassName = 'text-foreground',
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-[#0b0d11] px-4 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueClassName}`}>
        {value}
      </p>
      {sub ? <p className={`mt-0.5 text-[11px] tabular-nums ${valueClassName}`}>{sub}</p> : null}
    </div>
  );
}

export function PortfolioSummaryPanel({
  data,
  accountIdLabel,
}: PortfolioSummaryPanelProps) {
  const { cash, summary } = data;
  const unrealizedCls = pnlColorClass(summary.unrealizedPnL);
  const dayCls = pnlColorClass(summary.dayPnL);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Tổng quan tài sản</h2>
          <p className="mt-0.5 text-xs text-muted">
            Tài khoản <span className="font-mono text-foreground">{accountIdLabel}</span>
            {summary.positionCount > 0
              ? ` · ${summary.positionCount} mã đang nắm giữ`
              : ' · Chưa có vị thế'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-6">
        <SummaryCard
          label="Tổng tài sản (NAV)"
          value={`${formatVnd(summary.nav)} đ`}
        />
        <SummaryCard
          label="Tiền khả dụng"
          value={`${formatVnd(cash.available)} đ`}
          sub={cash.locked > 0 ? `Phong tỏa: ${formatVnd(cash.locked)} đ` : undefined}
        />
        <SummaryCard
          label="Giá trị chứng khoán"
          value={`${formatVnd(summary.totalMarketValue)} đ`}
          sub={`Giá vốn: ${formatVnd(summary.totalCostBasis)} đ`}
        />
        <SummaryCard
          label="Lãi / lỗ chưa thực hiện"
          value={`${formatSignedVnd(summary.unrealizedPnL)} đ`}
          sub={formatPercent(summary.unrealizedPnLPercent)}
          valueClassName={unrealizedCls}
        />
        <SummaryCard
          label="Lãi / lỗ trong ngày"
          value={`${formatSignedVnd(summary.dayPnL)} đ`}
          sub={formatPercent(summary.dayPnLPercent)}
          valueClassName={dayCls}
        />
        <SummaryCard
          label="Tổng tiền (khả dụng + phong tỏa)"
          value={`${formatVnd(cash.total)} đ`}
        />
      </div>
    </div>
  );
}
