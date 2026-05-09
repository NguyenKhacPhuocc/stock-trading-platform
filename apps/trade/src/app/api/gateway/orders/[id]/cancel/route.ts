import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayBackendOrigin, gatewayUpstreamCatch } from '@/lib/gateway-internal';

const ORDER_TIMEOUT_MS = 10_000;

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

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ORDER_TIMEOUT_MS);
  const origin = gatewayBackendOrigin();

  try {
    const { id } = await context.params;
    if (!id) {
      return gwResError('Thiếu mã lệnh cần hủy', {
        httpStatus: 400,
        ec: 400,
      });
    }
    const idempotencyKey = req.headers.get('idempotency-key') ?? '';
    const upstream = await fetch(`${origin}/api/orders/${id}`, {
      method: 'DELETE',
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        Cookie: req.headers.get('cookie') ?? '',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
    });

    const text = await upstream.text();
    const body = toBodyOrNull(text);
    if (!upstream.ok) {
      const em = pickUpstreamErrorMessage(body, 'Hủy lệnh thất bại');
      return gwResError(em, { httpStatus: upstream.status, ec: upstream.status });
    }

    if (body && typeof body === 'object' && 'd' in body) {
      return gwResSuccess((body as { d: unknown }).d);
    }
    return gwResSuccess(body);
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ hủy lệnh',
      connect: 'Lỗi kết nối máy chủ lệnh',
    });
  } finally {
    clearTimeout(timer);
  }
}
