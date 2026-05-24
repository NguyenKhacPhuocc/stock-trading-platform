import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayUpstreamCatch } from '@/lib/gateway-internal';
import {
  fetchWalletUpstream,
  WALLET_UPSTREAM_TIMEOUT_MS,
} from '@/lib/gateway-wallet-upstream';

export async function GET(req: NextRequest) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WALLET_UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetchWalletUpstream({
      req,
      path: '/api/wallet',
      signal: ac.signal,
      errorFallback: 'Không tải được số dư',
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
      timeout: 'Hết thời gian chờ số dư',
      connect: 'Lỗi kết nối máy chủ ví',
    });
  } finally {
    clearTimeout(timer);
  }
}
