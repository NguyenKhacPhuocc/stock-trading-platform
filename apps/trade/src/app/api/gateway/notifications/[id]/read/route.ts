import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayUpstreamCatch } from '@/lib/gateway-internal';
import { fetchBackendUpstream } from '@/lib/gateway-backend-upstream';
import { WALLET_UPSTREAM_TIMEOUT_MS } from '@/lib/gateway-wallet-upstream';

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WALLET_UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetchBackendUpstream({
      req,
      path: `/api/notifications/${encodeURIComponent(id)}/read`,
      method: 'PATCH',
      signal: ac.signal,
      errorFallback: 'Không cập nhật thông báo',
    });
    if (!upstream.ok) {
      return gwResError(upstream.errorMessage, {
        httpStatus: upstream.status,
        ec: upstream.status,
      });
    }
    return gwResSuccess(upstream.data ?? { ok: true });
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ thông báo',
      connect: 'Lỗi kết nối máy chủ',
    });
  } finally {
    clearTimeout(timer);
  }
}
