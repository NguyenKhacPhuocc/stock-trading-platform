import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayUpstreamCatch } from '@/lib/gateway-internal';
import {
  fetchWalletUpstream,
  WALLET_UPSTREAM_TIMEOUT_MS,
} from '@/lib/gateway-wallet-upstream';

type PortfolioPosition = {
  symbol: string;
  quantity: number;
  lockedQuantity: number;
};

function mapPositions(rows: unknown[]): PortfolioPosition[] {
  const out: PortfolioPosition[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const stock = (row as { stock?: { symbol?: string } }).stock;
    const symbol =
      typeof stock?.symbol === 'string' ? stock.symbol.trim().toUpperCase() : '';
    if (!symbol) continue;
    const quantity = Number((row as { quantity?: unknown }).quantity);
    const lockedQuantity = Number((row as { lockedQuantity?: unknown }).lockedQuantity);
    out.push({
      symbol,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
      lockedQuantity:
        Number.isFinite(lockedQuantity) && lockedQuantity > 0 ? lockedQuantity : 0,
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const tradingAccountId = req.nextUrl.searchParams.get('tradingAccountId');
  if (!tradingAccountId) {
    return gwResError('Thiếu tradingAccountId', { httpStatus: 400, ec: 400 });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WALLET_UPSTREAM_TIMEOUT_MS);

  try {
    const [wallet, positions] = await Promise.all([
      fetchWalletUpstream({
        req,
        path: '/api/wallet',
        tradingAccountId,
        signal: ac.signal,
        errorFallback: 'Không tải được số dư',
      }),
      fetchWalletUpstream({
        req,
        path: '/api/wallet/positions',
        tradingAccountId,
        signal: ac.signal,
        errorFallback: 'Không tải được danh mục',
      }),
    ]);

    if (!wallet.ok) {
      return gwResError(wallet.errorMessage, {
        httpStatus: wallet.status,
        ec: wallet.status,
      });
    }
    if (!positions.ok) {
      return gwResError(positions.errorMessage, {
        httpStatus: positions.status,
        ec: positions.status,
      });
    }

    const walletData =
      wallet.data && typeof wallet.data === 'object'
        ? (wallet.data as { availableBalance?: unknown })
        : null;
    const availableBalance = Number(walletData?.availableBalance);
    const positionRows = Array.isArray(positions.data) ? positions.data : [];

    return gwResSuccess({
      availableBalance: Number.isFinite(availableBalance) ? availableBalance : 0,
      positions: mapPositions(positionRows),
    });
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ sức mua/bán',
      connect: 'Lỗi kết nối máy chủ ví',
    });
  } finally {
    clearTimeout(timer);
  }
}
