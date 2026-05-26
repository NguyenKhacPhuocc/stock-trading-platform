'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AccountOrdersTable } from '@/components/account/account-orders-table';
import { ListPagination } from '@/components/ui/list-pagination';
import { mapOrderListItem } from '@/lib/order-list-map';
import type { OrderListStatusFilter } from '@/lib/filter-orders';
import { GATEWAY_ORDERS } from '@/lib/gateway-paths';
import {
  LIST_PAGE_SIZE,
  pageToOffset,
  parsePaginated,
} from '@/lib/pagination';
import { withTradingAccountQuery } from '@/lib/trading-account-query';
import { useAppSelector } from '@/store/hooks';
import { useRequireAuth } from '@/hooks/use-require-auth';

export default function AccountOrdersPage() {
  const { handleSessionExpired } = useRequireAuth();
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedAccount = tradingAccounts.find((a) => a.id === selectedTradingAccountId);
  const accountIdLabel = selectedAccount?.accountId ?? '--';

  const [orders, setOrders] = useState<ReturnType<typeof mapOrderListItem>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderListStatusFilter>('all');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [symbolDebounced, setSymbolDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSymbolDebounced(symbolFilter), 350);
    return () => clearTimeout(t);
  }, [symbolFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, symbolDebounced]);

  const load = useCallback(async () => {
    if (!selectedTradingAccountId) return;
    setLoading(true);
    try {
      const base = withTradingAccountQuery(GATEWAY_ORDERS.list, selectedTradingAccountId);
      const qs = new URLSearchParams({
        limit: String(LIST_PAGE_SIZE),
        offset: String(pageToOffset(page, LIST_PAGE_SIZE)),
      });
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (symbolDebounced.trim()) qs.set('symbol', symbolDebounced.trim());

      const res = await fetch(`${base}&${qs.toString()}`, {
        credentials: 'same-origin',
      });
      const json = await res.json();
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không tải được danh sách lệnh');
      }
      const parsed = parsePaginated<Record<string, unknown>>(json.d);
      setOrders(parsed.items.map((item) => mapOrderListItem(item)));
      setTotal(parsed.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [
    handleSessionExpired,
    page,
    selectedTradingAccountId,
    statusFilter,
    symbolDebounced,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Lịch sử lệnh</h1>
          <p className="mt-1 text-sm text-muted">
            Tiểu khoản <span className="font-mono text-foreground">{accountIdLabel}</span>
            {' · '}
            {LIST_PAGE_SIZE} lệnh/trang
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
        >
          Làm mới
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderListStatusFilter)}
          className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-sm text-foreground"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang chờ / khớp dở</option>
          <option value="filled">Đã khớp hết</option>
          <option value="cancelled">Đã hủy / từ chối</option>
        </select>
        <input
          type="text"
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          placeholder="Lọc mã CK..."
          className="w-32 rounded border border-border bg-[#11141b] px-2 py-1.5 text-sm placeholder:text-muted"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-[#0b0d11]">
        <AccountOrdersTable orders={orders} loading={loading} />
        <ListPagination
          page={page}
          pageSize={LIST_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          disabled={loading}
        />
      </div>

      <p className="text-xs text-muted">
        Hủy lệnh tại{' '}
        <Link href="/order" className="text-primary hover:underline">
          Đặt lệnh
        </Link>
        . Lịch sử khớp theo mã xem tại tab Khớp lệnh trên màn Đặt lệnh.
      </p>
    </div>
  );
}
