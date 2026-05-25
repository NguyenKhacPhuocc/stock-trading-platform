import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayUpstreamCatch } from '@/lib/gateway-internal';
import {
  fetchWalletUpstream,
  WALLET_UPSTREAM_TIMEOUT_MS,
} from '@/lib/gateway-wallet-upstream';

export async function GET(req: NextRequest) {
  const tradingAccountId = req.nextUrl.searchParams.get('tradingAccountId');
  if (!tradingAccountId) {
    return gwResError('Thiếu tradingAccountId', { httpStatus: 400, ec: 400 });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WALLET_UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetchWalletUpstream({
      req,
      path: '/api/wallet/positions',
      tradingAccountId,
      signal: ac.signal,
      errorFallback: 'Không tải được danh mục',
    });
    if (!upstream.ok) {
      return gwResError(upstream.errorMessage, {
        httpStatus: upstream.status,
        ec: upstream.status,
      });
    }
    return gwResSuccess(upstream.data);
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ danh mục',
      connect: 'Lỗi kết nối máy chủ ví',
    });
  } finally {
    clearTimeout(timer);
  }
}
