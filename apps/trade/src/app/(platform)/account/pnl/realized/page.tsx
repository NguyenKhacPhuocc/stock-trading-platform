'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AccountMetricCards } from '@/components/account/account-metric-cards';
import { ListPagination } from '@/components/ui/list-pagination';
import { formatDateTimeVN } from '@/lib/format-date';
import { defaultAuditDateRange } from '@/lib/default-date-range';
import { GATEWAY_WALLET } from '@/lib/gateway-paths';
import { formatPercent, pnlColorClass } from '@/lib/portfolio-format';
import {
  LIST_PAGE_SIZE,
  pageToOffset,
  parsePaginated,
} from '@/lib/pagination';
import { withTradingAccountQuery } from '@/lib/trading-account-query';
import { VndAmount } from '@/components/portfolio/vnd-amount';
import { useAppSelector } from '@/store/hooks';
import { useRequireAuth } from '@/hooks/use-require-auth';

type SellFillRow = {
  id: string;
  tradedAt: string;
  symbol: string;
  quantity: number;
  price: number;
  tradeValue: number;
  costBasisPrice: number;
  costAmount: number;
  realizedPnL: number;
  realizedPnLPercent: number;
};

type SellFillsSummary = {
  tradeCount: number;
  totalSellValue: number;
  totalCostAmount: number;
  totalRealizedPnL: number;
};

type SellFillsBySymbol = {
  symbol: string;
  tradeCount: number;
  quantity: number;
  sellValue: number;
  costAmount: number;
  realizedPnL: number;
};

const panelCard = 'rounded-md border border-border bg-[#0b0d11]';

export default function AccountPnlRealizedPage() {
  const { handleSessionExpired } = useRequireAuth();
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedAccount = tradingAccounts.find((a) => a.id === selectedTradingAccountId);
  const accountIdLabel = selectedAccount?.accountId ?? '--';

  const initial = defaultAuditDateRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [queryFrom, setQueryFrom] = useState(initial.from);
  const [queryTo, setQueryTo] = useState(initial.to);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SellFillRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SellFillsSummary | null>(null);
  const [bySymbol, setBySymbol] = useState<SellFillsBySymbol[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedTradingAccountId) return;
    setLoading(true);
    try {
      const base = withTradingAccountQuery(GATEWAY_WALLET.sellFills, selectedTradingAccountId);
      const qs = new URLSearchParams({
        from: queryFrom,
        to: queryTo,
        limit: String(LIST_PAGE_SIZE),
        offset: String(pageToOffset(page, LIST_PAGE_SIZE)),
      });
      const res = await fetch(`${base}&${qs.toString()}`, {
        credentials: 'same-origin',
      });
      const json = await res.json();
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không tải được dữ liệu');
      }
      const body = json.d as Record<string, unknown>;
      const parsed = parsePaginated<SellFillRow>(body);
      setRows(parsed.items);
      setTotal(parsed.total);
      const sum = body.summary as SellFillsSummary | undefined;
      setSummary(
        sum ?? {
          tradeCount: parsed.total,
          totalSellValue: 0,
          totalCostAmount: 0,
          totalRealizedPnL: 0,
        },
      );
      setBySymbol(
        Array.isArray(body.bySymbol) ? (body.bySymbol as SellFillsBySymbol[]) : [],
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [queryFrom, queryTo, page, handleSessionExpired, selectedTradingAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = () => {
    setQueryFrom(from);
    setQueryTo(to);
    setPage(1);
  };

  const summaryPct =
    summary && summary.totalCostAmount > 0
      ? (summary.totalRealizedPnL / summary.totalCostAmount) * 100
      : 0;

  const rowsMissingCost =
    rows.length > 0 && rows.every((r) => r.costBasisPrice <= 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-base font-semibold text-foreground">Lãi/lỗ đã thực hiện</h1>
        <p className="mt-1 text-sm text-muted">
          Tiểu khoản <span className="font-mono text-foreground">{accountIdLabel}</span>
        </p>
      </header>

      {summary ? (
        <AccountMetricCards
          items={[
            {
              label: 'Số lần bán (khớp)',
              hint: `${summary.tradeCount.toLocaleString('vi-VN')} lần trong kỳ`,
            },
            { label: 'Tổng giá trị bán', amount: summary.totalSellValue },
            { label: 'Tổng giá vốn', amount: summary.totalCostAmount },
            {
              label: 'Lãi/Lỗ đã thực hiện (kỳ)',
              amount: summary.totalRealizedPnL,
              signed: true,
              percent: summaryPct,
            },
          ]}
        />
      ) : null}

      {rowsMissingCost ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Chưa tính được giá vốn cho khớp bán trong kỳ. Thử bấm Tra cứu lại sau khi backend khởi
          động; nếu vẫn trống, liên hệ hỗ trợ.
        </p>
      ) : null}

      {bySymbol.length > 0 ? (
        <section className={`${panelCard} overflow-x-auto`}>
          <div className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
            Tổng hợp theo mã CK (kỳ đã chọn)
          </div>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="px-3 py-2 font-medium">Mã</th>
                <th className="px-3 py-2 font-medium text-right">Lần bán</th>
                <th className="px-3 py-2 font-medium text-right">KL bán</th>
                <th className="px-3 py-2 font-medium text-right">Giá trị bán</th>
                <th className="px-3 py-2 font-medium text-right">Giá vốn</th>
                <th className="px-3 py-2 font-medium text-right">Lãi/Lỗ thực hiện</th>
                <th className="px-3 py-2 font-medium text-right">% Lãi/Lỗ</th>
              </tr>
            </thead>
            <tbody>
              {bySymbol.map((row) => {
                const pnlCls = pnlColorClass(row.realizedPnL);
                const pct =
                  row.costAmount > 0 ? (row.realizedPnL / row.costAmount) * 100 : 0;
                return (
                  <tr key={row.symbol} className="border-b border-border/50">
                    <td className="px-3 py-2 font-semibold">{row.symbol}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.tradeCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.quantity.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <VndAmount amount={row.sellValue} size="xs" />
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      <VndAmount amount={row.costAmount} size="xs" />
                    </td>
                    <td className={`px-3 py-2 text-right ${pnlCls}`}>
                      <VndAmount
                        amount={row.realizedPnL}
                        signed
                        size="xs"
                        className={pnlCls}
                      />
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${pnlCls}`}>
                      {formatPercent(pct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="text-muted">
          Từ ngày
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-foreground"
          />
        </label>
        <label className="text-muted">
          Đến ngày
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-foreground"
          />
        </label>
        <button
          type="button"
          onClick={onSearch}
          disabled={loading}
          className="rounded bg-primary px-4 py-2 font-medium text-black disabled:opacity-50"
        >
          Tra cứu
        </button>
      </div>

      <section className={`${panelCard} overflow-x-auto`}>
        <div className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
          Chi tiết từng lần khớp bán
        </div>
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-3 py-2 font-medium">Thời gian</th>
              <th className="px-3 py-2 font-medium">Mã CK</th>
              <th className="px-3 py-2 font-medium text-right">KL bán</th>
              <th className="px-3 py-2 font-medium text-right">Giá bán</th>
              <th className="px-3 py-2 font-medium text-right">Giá vốn</th>
              <th className="px-3 py-2 font-medium text-right">Lãi/Lỗ thực hiện</th>
              <th className="px-3 py-2 font-medium text-right">% Lãi/Lỗ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  {loading ? 'Đang tải...' : 'Chưa có khớp bán trong kỳ'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const pnlCls = pnlColorClass(row.realizedPnL);
                const hasCost = row.costBasisPrice > 0;
                return (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="px-3 py-2 text-muted">{formatDateTimeVN(row.tradedAt)}</td>
                    <td className="px-3 py-2 font-medium">{row.symbol}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.quantity.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <VndAmount amount={row.price} size="xs" />
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      {hasCost ? (
                        <VndAmount amount={row.costBasisPrice} size="xs" />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right ${pnlCls}`}>
                      {hasCost ? (
                        <VndAmount
                          amount={row.realizedPnL}
                          signed
                          size="xs"
                          className={pnlCls}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${pnlCls}`}>
                      {hasCost ? formatPercent(row.realizedPnLPercent) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <ListPagination
          page={page}
          pageSize={LIST_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          disabled={loading}
        />
      </section>
    </div>
  );
}
