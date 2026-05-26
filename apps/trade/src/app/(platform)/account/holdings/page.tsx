'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AccountMetricCards } from '@/components/account/account-metric-cards';
import { PortfolioPositionsTable } from '@/components/portfolio/portfolio-positions-table';
import { usePortfolioOverview } from '@/hooks/use-portfolio-overview';
import {
  applyLiveMarketToPosition,
  summarizeLivePositions,
} from '@/lib/portfolio-live-metrics';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearUser } from '@/store/slices/auth.slice';

export default function AccountHoldingsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const marketEntities = useAppSelector((s) => s.market.entities);
  const { data, isLoading, error, reload } = usePortfolioOverview(
    isAuthenticated,
    selectedTradingAccountId,
  );
  const selectedAccount = tradingAccounts.find((a) => a.id === selectedTradingAccountId);
  const accountIdLabel =
    selectedAccount?.accountId ?? data?.accountId ?? '--';

  const livePositions = useMemo(() => {
    if (!data) return [];
    return data.positions.map((row) =>
      applyLiveMarketToPosition(row, marketEntities[row.symbol.toUpperCase()]),
    );
  }, [data, marketEntities]);

  const liveSummary = useMemo(
    () => summarizeLivePositions(livePositions),
    [livePositions],
  );

  useEffect(() => {
    if (error === 'Phiên đăng nhập đã hết hạn') {
      dispatch(clearUser());
      toast.error(error);
      router.replace('/priceboard');
    }
  }, [error, dispatch, router]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-muted">
        Đang tải danh mục...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-sm">
        <p className="text-red-500">{error}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded border border-border px-3 py-1.5 text-foreground hover:bg-surface-2"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-foreground">Danh mục đầu tư</h1>
          <p className="mt-1 text-sm text-muted">
            Tiểu khoản <span className="font-mono text-foreground">{accountIdLabel}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload({ silent: true })}
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-2"
        >
          Làm mới
        </button>
      </div>

      <PortfolioPositionsTable positions={livePositions} />
      <p className="text-xs text-muted">
        <Link href="/account" className="text-primary hover:underline">
          Tổng hợp tài sản
        </Link>
        {' · '}
        <Link href="/account/pnl/realized" className="text-primary hover:underline">
          Lãi/lỗ đã thực hiện
        </Link>
      </p>
    </div>
  );
}
