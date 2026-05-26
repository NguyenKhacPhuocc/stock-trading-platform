'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { ListPagination } from '@/components/ui/list-pagination';
import { parseApiInstant } from '@/lib/format-date';
import { defaultAuditDateRange } from '@/lib/default-date-range';
import { GATEWAY_WALLET } from '@/lib/gateway-paths';
import { formatStockLedgerType } from '@/lib/stock-ledger-labels';
import {
  LIST_PAGE_SIZE,
  pageToOffset,
  parsePaginated,
} from '@/lib/pagination';
import { withTradingAccountQuery } from '@/lib/trading-account-query';
import { useAppSelector } from '@/store/hooks';
import { useRequireAuth } from '@/hooks/use-require-auth';

type StockStatementRow = {
  id: string;
  createdAt: string;
  symbol: string;
  type: string;
  quantityDelta: number;
  lockedDelta: number;
  description: string | null;
};

type StockStatementSummary = {
  totalIncrease: number;
  totalDecrease: number;
  netQuantity: number;
};

const panelCard = 'rounded-md border border-border bg-surface';
const inputClass =
  'h-9 min-w-[9.5rem] rounded border border-border bg-[#0b0d11] px-2.5 text-sm text-foreground';
const VN_TZ = 'Asia/Ho_Chi_Minh';

function formatDateVN(iso: string): string {
  const ms = parseApiInstant(iso);
  if (ms == null) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ms));
}

function splitIncreaseDecrease(row: StockStatementRow): {
  increase: number;
  decrease: number;
} {
  const net = row.quantityDelta + row.lockedDelta;
  if (net > 0) return { increase: net, decrease: 0 };
  if (net < 0) return { increase: 0, decrease: Math.abs(net) };
  return { increase: 0, decrease: 0 };
}

function rowDescription(row: StockStatementRow): string {
  return row.description?.trim() || formatStockLedgerType(row.type);
}

function formatQty(n: number): string {
  if (n <= 0) return '';
  return n.toLocaleString('vi-VN');
}

export default function AccountStockLedgerPage() {
  const { handleSessionExpired } = useRequireAuth();
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedAccount = tradingAccounts.find((a) => a.id === selectedTradingAccountId);
  const accountIdLabel = selectedAccount?.accountId ?? '--';

  const initial = defaultAuditDateRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [symbol, setSymbol] = useState('');
  const [queryFrom, setQueryFrom] = useState(initial.from);
  const [queryTo, setQueryTo] = useState(initial.to);
  const [querySymbol, setQuerySymbol] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StockStatementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<StockStatementSummary | null>(null);
  const [symbolOptions, setSymbolOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSymbols = useCallback(async () => {
    if (!selectedTradingAccountId) return;
    try {
      const base = withTradingAccountQuery(
        GATEWAY_WALLET.overview,
        selectedTradingAccountId,
      );
      const res = await fetch(base, { credentials: 'same-origin' });
      const json = await res.json();
      if (!res.ok || json?.s !== 'ok') return;
      const positions = (json.d as { positions?: { symbol: string }[] })?.positions;
      if (!Array.isArray(positions)) return;
      const syms = [...new Set(positions.map((p) => p.symbol).filter(Boolean))].sort();
      setSymbolOptions(syms);
    } catch {
      /* bỏ qua — vẫn tra cứu được */
    }
  }, [selectedTradingAccountId]);

  const load = useCallback(async () => {
    if (!selectedTradingAccountId) return;
    setLoading(true);
    try {
      const base = withTradingAccountQuery(
        GATEWAY_WALLET.stockStatement,
        selectedTradingAccountId,
      );
      const qs = new URLSearchParams({
        from: queryFrom,
        to: queryTo,
        limit: String(LIST_PAGE_SIZE),
        offset: String(pageToOffset(page, LIST_PAGE_SIZE)),
      });
      if (querySymbol.trim()) qs.set('symbol', querySymbol.trim().toUpperCase());

      const res = await fetch(`${base}&${qs.toString()}`, {
        credentials: 'same-origin',
      });
      const json = await res.json();
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không tải được sao kê');
      }
      const body = json.d as Record<string, unknown>;
      const parsed = parsePaginated<StockStatementRow>(body);
      setRows(parsed.items);
      setTotal(parsed.total);
      setSummary(
        (body.summary as StockStatementSummary | undefined) ?? {
          totalIncrease: 0,
          totalDecrease: 0,
          netQuantity: 0,
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [
    queryFrom,
    queryTo,
    querySymbol,
    page,
    handleSessionExpired,
    selectedTradingAccountId,
  ]);

  useEffect(() => {
    void loadSymbols();
  }, [loadSymbols]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = () => {
    setQueryFrom(from);
    setQueryTo(to);
    setQuerySymbol(symbol);
    setPage(1);
  };

  const totalIncrease = summary?.totalIncrease ?? 0;
  const totalDecreaseAbs = summary ? Math.abs(summary.totalDecrease) : 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Tiểu khoản <span className="font-mono text-foreground">{accountIdLabel}</span>
      </p>

      <section className={`${panelCard} overflow-hidden`}>
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-base font-semibold text-foreground">Sao kê cổ phiếu</h1>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-4 py-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">Từ ngày</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">Đến ngày</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">Mã CK</span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className={`${inputClass} min-w-[7rem] font-mono`}
            >
              <option value="">Tất cả</option>
              {symbolOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className="h-9 rounded bg-primary px-6 text-sm font-semibold text-black disabled:opacity-50"
          >
            Tìm kiếm
          </button>
          <button
            type="button"
            onClick={() => toast.message('Tải file sẽ bổ sung sau')}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded border border-border bg-transparent px-4 text-sm text-foreground hover:bg-surface-2"
          >
            <Download className="size-4" />
            Tải file
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-[#11141b] text-muted">
                <th
                  className="w-[10%] border-r border-border/50 px-3 py-2.5 text-left font-medium"
                  rowSpan={2}
                >
                  Ngày
                </th>
                <th
                  className="w-[8%] border-r border-border/50 px-3 py-2.5 text-left font-medium"
                  rowSpan={2}
                >
                  Mã CK
                </th>
                <th
                  className="border-r border-border/50 px-3 py-2.5 text-left font-medium"
                  rowSpan={2}
                >
                  Mô tả
                </th>
                <th
                  className="border-b border-border/50 px-3 py-2 text-center font-medium"
                  colSpan={2}
                >
                  Chi tiết giao dịch CK
                </th>
              </tr>
              <tr className="border-b border-border bg-[#11141b] text-muted">
                <th className="w-[8%] border-r border-border/50 px-2 py-2 text-center align-middle font-medium">
                  Tăng
                </th>
                <th className="w-[8%] px-2 py-2 text-center align-middle font-medium">
                  Giảm
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#0b0d11]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center text-muted">
                    Đang tải...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center text-muted">
                    Không có dữ liệu trong kỳ đã chọn
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => {
                  const { increase, decrease } = splitIncreaseDecrease(row);
                  return (
                    <tr
                      key={row.id}
                      className={
                        i % 2 === 0
                          ? 'border-b border-border/40'
                          : 'border-b border-border/40 bg-[#0e1015]'
                      }
                    >
                      <td className="border-r border-border/30 px-3 py-2.5 text-muted">
                        {formatDateVN(row.createdAt)}
                      </td>
                      <td className="border-r border-border/30 px-3 py-2.5 font-semibold text-foreground">
                        {row.symbol}
                      </td>
                      <td
                        className="truncate border-r border-border/30 px-3 py-2.5 text-foreground"
                        title={rowDescription(row)}
                      >
                        {rowDescription(row)}
                      </td>
                      <td className="border-r border-border/30 px-2 py-2.5 text-center align-middle tabular-nums text-price-up">
                        {formatQty(increase)}
                      </td>
                      <td className="px-2 py-2.5 text-center align-middle tabular-nums text-price-down">
                        {formatQty(decrease)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && summary ? (
              <tfoot>
                <tr className="border-t border-border bg-[#11141b] font-semibold text-foreground">
                  <td className="border-r border-border/30 px-3 py-2.5" colSpan={3}>
                    Tổng cộng
                  </td>
                  <td className="border-r border-border/30 px-2 py-2.5 text-center align-middle tabular-nums text-price-up">
                    {totalIncrease.toLocaleString('vi-VN')}
                  </td>
                  <td className="px-2 py-2.5 text-center align-middle tabular-nums text-price-down">
                    {totalDecreaseAbs.toLocaleString('vi-VN')}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {total > LIST_PAGE_SIZE ? (
          <div className="border-t border-border px-2 py-1">
            <ListPagination
              page={page}
              pageSize={LIST_PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              disabled={loading}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
