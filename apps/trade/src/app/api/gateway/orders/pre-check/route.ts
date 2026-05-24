import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayBackendOrigin, gatewayUpstreamCatch } from '@/lib/gateway-internal';

const PRE_CHECK_TIMEOUT_MS = 10_000;

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

export async function POST(req: NextRequest) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PRE_CHECK_TIMEOUT_MS);
  const origin = gatewayBackendOrigin();

  try {
    const payload = await req.json();
    const upstream = await fetch(`${origin}/api/orders/pre-check`, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    const body = toBodyOrNull(text);
    if (!upstream.ok) {
      const em = pickUpstreamErrorMessage(body, 'Không kiểm tra được lệnh');
      return gwResError(em, { httpStatus: upstream.status, ec: upstream.status });
    }

    if (body && typeof body === 'object' && 'd' in body) {
      return gwResSuccess((body as { d: unknown }).d);
    }
    return gwResSuccess(body);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return gwResError('Dữ liệu gửi lên không hợp lệ', {
        httpStatus: 400,
        ec: 400,
      });
    }
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ kiểm tra lệnh',
      connect: 'Lỗi kết nối máy chủ lệnh',
    });
  } finally {
    clearTimeout(timer);
  }
}
