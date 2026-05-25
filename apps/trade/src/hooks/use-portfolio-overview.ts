'use client';

import { useCallback, useEffect, useState } from 'react';
import { GATEWAY_WALLET } from '@/lib/gateway-paths';
import { withTradingAccountQuery } from '@/lib/trading-account-query';
import { PORTFOLIO_REFRESH_EVT } from '@/lib/order-fill-notify';

export type PortfolioPositionRow = {
  stockId: string;
  symbol: string;
  exchange: string;
  quantity: number;
  lockedQuantity: number;
  totalQuantity: number;
  avgPrice: number;
  referencePrice: number;
  marketPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayPnL: number;
  dayChangePercent: number;
};

export type PortfolioOverview = {
  accountId: string;
  cash: { available: number; locked: number; total: number };
  summary: {
    nav: number;
    totalMarketValue: number;
    totalCostBasis: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    dayPnL: number;
    dayPnLPercent: number;
    positionCount: number;
  };
  positions: PortfolioPositionRow[];
};

function parseOverview(raw: unknown): PortfolioOverview | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const cashRaw = o.cash as Record<string, unknown> | undefined;
  const sumRaw = o.summary as Record<string, unknown> | undefined;
  if (!cashRaw || !sumRaw) return null;

  const positions = Array.isArray(o.positions)
    ? o.positions
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const p = row as Record<string, unknown>;
          const symbol = typeof p.symbol === 'string' ? p.symbol : '';
          if (!symbol) return null;
          return {
            stockId: String(p.stockId ?? ''),
            symbol,
            exchange: String(p.exchange ?? 'HOSE'),
            quantity: Number(p.quantity) || 0,
            lockedQuantity: Number(p.lockedQuantity) || 0,
            totalQuantity: Number(p.totalQuantity) || 0,
            avgPrice: Number(p.avgPrice) || 0,
            referencePrice: Number(p.referencePrice) || 0,
            marketPrice: Number(p.marketPrice) || 0,
            marketValue: Number(p.marketValue) || 0,
            costBasis: Number(p.costBasis) || 0,
            unrealizedPnL: Number(p.unrealizedPnL) || 0,
            unrealizedPnLPercent: Number(p.unrealizedPnLPercent) || 0,
            dayPnL: Number(p.dayPnL) || 0,
            dayChangePercent: Number(p.dayChangePercent) || 0,
          } satisfies PortfolioPositionRow;
        })
        .filter((x): x is PortfolioPositionRow => x != null)
    : [];

  return {
    accountId: String(o.accountId ?? ''),
    cash: {
      available: Number(cashRaw.available) || 0,
      locked: Number(cashRaw.locked) || 0,
      total: Number(cashRaw.total) || 0,
    },
    summary: {
      nav: Number(sumRaw.nav) || 0,
      totalMarketValue: Number(sumRaw.totalMarketValue) || 0,
      totalCostBasis: Number(sumRaw.totalCostBasis) || 0,
      unrealizedPnL: Number(sumRaw.unrealizedPnL) || 0,
      unrealizedPnLPercent: Number(sumRaw.unrealizedPnLPercent) || 0,
      dayPnL: Number(sumRaw.dayPnL) || 0,
      dayPnLPercent: Number(sumRaw.dayPnLPercent) || 0,
      positionCount: Number(sumRaw.positionCount) || 0,
    },
    positions,
  };
}

export function usePortfolioOverview(
  enabled: boolean,
  tradingAccountId: string | null | undefined,
) {
  const [data, setData] = useState<PortfolioOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!enabled || !tradingAccountId) return;
    if (!opts?.silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        withTradingAccountQuery(GATEWAY_WALLET.overview, tradingAccountId),
        { credentials: 'same-origin' },
      );
      if (res.status === 401) {
        setError('Phiên đăng nhập đã hết hạn');
        return;
      }
      const json = await res.json();
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không tải được danh mục');
      }
      const parsed = parseOverview(json.d);
      if (!parsed) throw new Error('Dữ liệu danh mục không hợp lệ');
      setData(parsed);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Không tải được danh mục';
      setError(message);
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, [enabled, tradingAccountId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    const onRefresh = () => void reload({ silent: true });
    window.addEventListener(PORTFOLIO_REFRESH_EVT, onRefresh);
    return () => window.removeEventListener(PORTFOLIO_REFRESH_EVT, onRefresh);
  }, [enabled, reload]);

  return { data, isLoading, error, reload };
}
