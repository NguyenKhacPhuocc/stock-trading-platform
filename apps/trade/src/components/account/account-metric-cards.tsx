'use client';

import { VndAmount } from '@/components/portfolio/vnd-amount';
import { formatPercent, pnlColorClass } from '@/lib/portfolio-format';

export type AccountMetric = {
  label: string;
  amount?: number;
  signed?: boolean;
  percent?: number;
  hint?: string;
};

type AccountMetricCardsProps = {
  items: AccountMetric[];
};

export function AccountMetricCards({ items }: AccountMetricCardsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((m) => {
        const pctCls = m.percent != null ? pnlColorClass(m.percent) : '';
        const amtCls = m.amount != null ? pnlColorClass(m.amount) : '';
        return (
          <div
            key={m.label}
            className="rounded-md border border-border bg-[#0b0d11] px-3 py-2.5"
          >
            <p className="text-[11px] text-muted">{m.label}</p>
            {m.amount != null ? (
              <VndAmount
                amount={m.amount}
                signed={m.signed}
                size="sm"
                className={amtCls}
              />
            ) : m.hint ? (
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{m.hint}</p>
            ) : null}
            {m.percent != null ? (
              <p className={`mt-0.5 text-xs tabular-nums ${pctCls}`}>
                {formatPercent(m.percent)}
              </p>
            ) : null}
            {m.hint && m.amount != null ? (
              <p className="mt-1 text-[10px] leading-snug text-muted">{m.hint}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
