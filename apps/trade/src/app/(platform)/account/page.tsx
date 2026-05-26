'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PortfolioSummaryPanel } from '@/components/portfolio/portfolio-summary-panel';
import { usePortfolioOverview } from '@/hooks/use-portfolio-overview';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearUser } from '@/store/slices/auth.slice';

export default function AccountOverviewPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const { data, isLoading, error, reload } = usePortfolioOverview(
    isAuthenticated,
    selectedTradingAccountId,
  );
  const selectedAccount = tradingAccounts.find((a) => a.id === selectedTradingAccountId);
  const accountIdLabel =
    selectedAccount?.accountId ?? data?.accountId ?? '--';

  useEffect(() => {
    if (error === 'Phiên đăng nhập đã hết hạn') {
      dispatch(clearUser());
      toast.error(error);
      router.replace('/priceboard');
    }
  }, [error, dispatch, router]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
        Đang tải tài khoản...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm">
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
    <PortfolioSummaryPanel
      data={data}
      accountIdLabel={accountIdLabel}
      onRefresh={() => void reload({ silent: true })}
      isRefreshing={isLoading}
    />
  );
}
