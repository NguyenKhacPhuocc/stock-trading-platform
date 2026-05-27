'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AccountOrdersTable } from '@/components/account/account-orders-table';
import { AccountTradesTable } from '@/components/account/account-trades-table';
import { ListPagination } from '@/components/ui/list-pagination';
import { mapOrderListItem } from '@/lib/order-list-map';
import type { OrderListStatusFilter } from '@/lib/filter-orders';
import { GATEWAY_ORDERS, GATEWAY_WALLET } from '@/lib/gateway-paths';
import {
  LIST_PAGE_SIZE,
  pageToOffset,
  parsePaginated,
} from '@/lib/pagination';
import { withTradingAccountQuery } from '@/lib/trading-account-query';
import { useAppSelector } from '@/store/hooks';
import { useRequireAuth } from '@/hooks/use-require-auth';

type Tab = 'orders' | 'trades';

export default function AccountOrdersPage() {
  const { handleSessionExpired } = useRequireAuth();
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedAccount = tradingAccounts.find((a) => a.id === selectedTradingAccountId);
  const accountIdLabel = selectedAccount?.accountId ?? '--';

  const [activeTab, setActiveTab] = useState<Tab>('orders');

  const [orders, setOrders] = useState<ReturnType<typeof mapOrderListItem>[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderListStatusFilter>('all');
  const [orderSymbolFilter, setOrderSymbolFilter] = useState('');
  const [orderSymbolDebounced, setOrderSymbolDebounced] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [trades, setTrades] = useState<any[]>([]);
  const [tradesTotal, setTradesTotal] = useState(0);
  const [tradesPage, setTradesPage] = useState(1);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradeSymbolFilter, setTradeSymbolFilter] = useState('');
  const [tradeSymbolDebounced, setTradeSymbolDebounced] = useState('');
  const [tradeFromDate, setTradeFromDate] = useState('');
  const [tradeToDate, setTradeToDate] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setOrderSymbolDebounced(orderSymbolFilter), 350);
    return () => clearTimeout(t);
  }, [orderSymbolFilter]);

  useEffect(() => {
    const t = setTimeout(() => setTradeSymbolDebounced(tradeSymbolFilter), 350);
    return () => clearTimeout(t);
  }, [tradeSymbolFilter]);

  useEffect(() => {
    setOrdersPage(1);
  }, [statusFilter, orderSymbolDebounced, fromDate, toDate]);

  useEffect(() => {
    setTradesPage(1);
  }, [tradeSymbolDebounced, tradeFromDate, tradeToDate]);

  const loadOrders = useCallback(async () => {
    if (!selectedTradingAccountId) return;
    setOrdersLoading(true);
    try {
      const base = withTradingAccountQuery(GATEWAY_ORDERS.list, selectedTradingAccountId);
      const qs = new URLSearchParams({
        limit: String(LIST_PAGE_SIZE),
        offset: String(pageToOffset(ordersPage, LIST_PAGE_SIZE)),
      });
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (orderSymbolDebounced.trim()) qs.set('symbol', orderSymbolDebounced.trim());
      if (fromDate) qs.set('from', fromDate);
      if (toDate) qs.set('to', toDate);

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
      setOrdersTotal(parsed.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi tải dữ liệu');
    } finally {
      setOrdersLoading(false);
    }
  }, [
    handleSessionExpired,
    ordersPage,
    selectedTradingAccountId,
    statusFilter,
    orderSymbolDebounced,
    fromDate,
    toDate,
  ]);

  const loadTrades = useCallback(async () => {
    if (!selectedTradingAccountId) return;
    setTradesLoading(true);
    try {
      const base = withTradingAccountQuery(GATEWAY_WALLET.accountTrades, selectedTradingAccountId);
      const qs = new URLSearchParams({
        limit: String(LIST_PAGE_SIZE),
        offset: String(pageToOffset(tradesPage, LIST_PAGE_SIZE)),
      });
      if (tradeSymbolDebounced.trim()) qs.set('symbol', tradeSymbolDebounced.trim());
      if (tradeFromDate) qs.set('from', tradeFromDate);
      if (tradeToDate) qs.set('to', tradeToDate);

      const res = await fetch(`${base}&${qs.toString()}`, {
        credentials: 'same-origin',
      });
      const json = await res.json();
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không tải được lịch sử khớp');
      }
      const parsed = parsePaginated<Record<string, unknown>>(json.d);
      setTrades(parsed.items);
      setTradesTotal(parsed.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi tải dữ liệu');
    } finally {
      setTradesLoading(false);
    }
  }, [
    handleSessionExpired,
    tradesPage,
    selectedTradingAccountId,
    tradeSymbolDebounced,
    tradeFromDate,
    tradeToDate,
  ]);

  useEffect(() => {
    if (activeTab === 'orders') {
      void loadOrders();
    } else {
      void loadTrades();
    }
  }, [activeTab, loadOrders, loadTrades]);

  const handleRefresh = () => {
    if (activeTab === 'orders') {
      void loadOrders();
    } else {
      void loadTrades();
    }
  };

  const loading = activeTab === 'orders' ? ordersLoading : tradesLoading;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Lịch sử lệnh</h1>
          <p className="mt-1 text-sm text-muted">
            Tiểu khoản <span className="font-mono text-foreground">{accountIdLabel}</span>
            {' · '}
            {LIST_PAGE_SIZE} mục/trang
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
        >
          Làm mới
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'orders'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Lịch sử đặt lệnh
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'trades'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Lịch sử khớp lệnh
        </button>
      </div>

      {/* Filters for Orders tab */}
      {activeTab === 'orders' && (
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
            value={orderSymbolFilter}
            onChange={(e) => setOrderSymbolFilter(e.target.value)}
            placeholder="Lọc mã CK..."
            className="w-32 rounded border border-border bg-[#11141b] px-2 py-1.5 text-sm placeholder:text-muted"
          />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-sm text-foreground"
            placeholder="Từ ngày"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-sm text-foreground"
            placeholder="Đến ngày"
          />
        </div>
      )}

      {/* Filters for Trades tab */}
      {activeTab === 'trades' && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={tradeSymbolFilter}
            onChange={(e) => setTradeSymbolFilter(e.target.value)}
            placeholder="Lọc mã CK..."
            className="w-32 rounded border border-border bg-[#11141b] px-2 py-1.5 text-sm placeholder:text-muted"
          />
          <input
            type="date"
            value={tradeFromDate}
            onChange={(e) => setTradeFromDate(e.target.value)}
            className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-sm text-foreground"
            placeholder="Từ ngày"
          />
          <input
            type="date"
            value={tradeToDate}
            onChange={(e) => setTradeToDate(e.target.value)}
            className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-sm text-foreground"
            placeholder="Đến ngày"
          />
        </div>
      )}

      {/* Content */}
      <div className="overflow-hidden rounded-md border border-border bg-[#0b0d11]">
        {activeTab === 'orders' ? (
          <>
            <AccountOrdersTable orders={orders} loading={ordersLoading} />
            <ListPagination
              page={ordersPage}
              pageSize={LIST_PAGE_SIZE}
              total={ordersTotal}
              onPageChange={setOrdersPage}
              disabled={ordersLoading}
            />
          </>
        ) : (
          <>
            <AccountTradesTable trades={trades} loading={tradesLoading} />
            <ListPagination
              page={tradesPage}
              pageSize={LIST_PAGE_SIZE}
              total={tradesTotal}
              onPageChange={setTradesPage}
              disabled={tradesLoading}
            />
          </>
        )}
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
