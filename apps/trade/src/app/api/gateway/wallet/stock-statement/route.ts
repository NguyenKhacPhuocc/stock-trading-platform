import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayUpstreamCatch } from '@/lib/gateway-internal';
import { fetchBackendUpstream } from '@/lib/gateway-backend-upstream';
import { WALLET_UPSTREAM_TIMEOUT_MS } from '@/lib/gateway-wallet-upstream';

function backendQuery(req: NextRequest): string {
  const keys = ['from', 'to', 'limit', 'offset', 'symbol'] as const;
  const qs = new URLSearchParams();
  for (const k of keys) {
    const v = req.nextUrl.searchParams.get(k);
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function GET(req: NextRequest) {
  const tradingAccountId = req.nextUrl.searchParams.get('tradingAccountId');
  if (!tradingAccountId) {
    return gwResError('Thiếu tradingAccountId', { httpStatus: 400, ec: 400 });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WALLET_UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetchBackendUpstream({
      req,
      path: `/api/wallet/stock-statement${backendQuery(req)}`,
      tradingAccountId,
      signal: ac.signal,
      errorFallback: 'Không tải được sao kê chứng khoán',
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
      timeout: 'Hết thời gian chờ sao kê',
      connect: 'Lỗi kết nối máy chủ',
    });
  } finally {
    clearTimeout(timer);
  }
}
