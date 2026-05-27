'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { GATEWAY_WALLET } from '@/lib/gateway-paths';
import { withTradingAccountQuery } from '@/lib/trading-account-query';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearUser } from '@/store/slices/auth.slice';

const Chart = dynamic(() => import('highcharts-react-official'), { ssr: false });
const Highcharts = typeof window !== 'undefined' ? require('highcharts') : null;

type NavDataPoint = {
  snapshotAt: string;
  nav: number;
  cashTotal: number;
  stockValue: number;
  unrealizedPnL: number;
};

type Period = '1M' | '3M' | '6M' | 'YTD' | 'ALL';

export default function AccountPerformancePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const selectedAccount = tradingAccounts.find((a) => a.id === selectedTradingAccountId);
  const accountIdLabel = selectedAccount?.accountId ?? '--';

  const [data, setData] = useState<NavDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('1M');

  const load = useCallback(async () => {
    if (!selectedTradingAccountId) return;
    setIsLoading(true);
    setError(null);
    try {
      const now = new Date();
      let from: string | undefined;
      
      switch (period) {
        case '1M':
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '3M':
          from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '6M':
          from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'YTD':
          from = `${now.getFullYear()}-01-01`;
          break;
        case 'ALL':
          from = undefined;
          break;
      }

      const base = withTradingAccountQuery(GATEWAY_WALLET.navHistory, selectedTradingAccountId);
      const qs = new URLSearchParams({ limit: '500' });
      if (from) qs.set('from', from);

      const res = await fetch(`${base}&${qs.toString()}`, {
        credentials: 'same-origin',
      });
      const json = await res.json();
      
      if (res.status === 401) {
        dispatch(clearUser());
        setError('Phiên đăng nhập đã hết hạn');
        toast.error('Phiên đăng nhập đã hết hạn');
        router.replace('/priceboard');
        return;
      }
      
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không tải được dữ liệu');
      }

      setData(json.d?.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi tải dữ liệu';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTradingAccountId, period, dispatch, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartOptions = {
    chart: {
      backgroundColor: '#0b0d11',
      style: { fontFamily: 'inherit' },
    },
    title: {
      text: 'Lịch sử NAV',
      style: { color: '#e5e7eb' },
    },
    xAxis: {
      type: 'datetime',
      labels: { style: { color: '#9ca3af' } },
      gridLineColor: '#1f2937',
    },
    yAxis: {
      title: { text: 'NAV (VND)', style: { color: '#9ca3af' } },
      labels: { style: { color: '#9ca3af' } },
      gridLineColor: '#1f2937',
    },
    series: [
      {
        name: 'NAV',
        data: data.map((d) => [new Date(d.snapshotAt).getTime(), d.nav]),
        color: '#21CE3C',
        lineWidth: 2,
      },
    ],
    legend: { itemStyle: { color: '#9ca3af' } },
    tooltip: {
      backgroundColor: '#1f2937',
      style: { color: '#e5e7eb' },
      valueDecimals: 0,
      valueSuffix: ' VND',
    },
    credits: { enabled: false },
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
        Vui lòng đăng nhập
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Hiệu quả đầu tư</h1>
          <p className="mt-1 text-sm text-muted">
            Tiểu khoản <span className="font-mono text-foreground">{accountIdLabel}</span>
            {data.length > 0 && ` · ${data.length} điểm dữ liệu`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
        >
          Làm mới
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['1M', '3M', '6M', 'YTD', 'ALL'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded px-3 py-1.5 text-sm ${
              period === p
                ? 'bg-primary text-white'
                : 'border border-border hover:bg-surface-2'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {isLoading && !data.length ? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
          Đang tải...
        </div>
      ) : error ? (
        <div className="rounded-md border border-border bg-surface p-4 text-sm text-muted">
          {error}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-4 text-sm text-muted">
          Chưa có dữ liệu NAV. Dữ liệu sẽ được ghi sau mỗi lần khớp lệnh.
        </div>
      ) : (
        <div className="rounded-md border border-border bg-[#0b0d11] p-4">
          {Highcharts && <Chart highcharts={Highcharts} options={chartOptions} />}
        </div>
      )}
    </div>
  );
}
