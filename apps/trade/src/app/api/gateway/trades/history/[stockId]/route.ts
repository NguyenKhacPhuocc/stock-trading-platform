import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayBackendOrigin, gatewayUpstreamCatch } from '@/lib/gateway-internal';

const TRADES_TIMEOUT_MS = 10_000;

function toBodyOrNull(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickUpstreamErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  if ('em' in body && typeof (body as { em?: unknown }).em === 'string') {
    return String((body as { em?: unknown }).em);
  }
  if (
    'message' in body &&
    typeof (body as { message?: unknown }).message === 'string'
  ) {
    return String((body as { message?: unknown }).message);
  }
  return fallback;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stockId: string }> },
) {
  const { stockId } = await params;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TRADES_TIMEOUT_MS);
  const origin = gatewayBackendOrigin();

  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = searchParams.get('limit') ?? '20';

    const upstream = await fetch(
      `${origin}/api/trades/history/${encodeURIComponent(stockId)}?limit=${encodeURIComponent(limit)}`,
      {
        method: 'GET',
        signal: ac.signal,
        headers: {
          Accept: 'application/json',
          Cookie: req.headers.get('cookie') ?? '',
        },
      },
    );

    const text = await upstream.text();
    const body = toBodyOrNull(text);
    if (!upstream.ok) {
      const em = pickUpstreamErrorMessage(body, 'Không tải được lịch sử khớp lệnh');
      return gwResError(em, { httpStatus: upstream.status, ec: upstream.status });
    }

    if (Array.isArray(body)) return gwResSuccess(body);
    if (body && typeof body === 'object' && 'd' in body) {
      return gwResSuccess((body as { d: unknown }).d);
    }
    return gwResSuccess([]);
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ lịch sử khớp lệnh',
      connect: 'Lỗi kết nối máy chủ lệnh',
    });
  } finally {
    clearTimeout(timer);
  }
}
