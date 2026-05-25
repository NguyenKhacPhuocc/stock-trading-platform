import type { NextRequest } from 'next/server';
import { gatewayBackendOrigin } from '@/lib/gateway-internal';

export const WALLET_UPSTREAM_TIMEOUT_MS = 10_000;

export function parseUpstreamBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function pickUpstreamErrorMessage(body: unknown, fallback: string): string {
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

export function unwrapGatewayData(body: unknown): unknown {
  if (body && typeof body === 'object' && 'd' in body) {
    return (body as { d: unknown }).d;
  }
  return body;
}

export async function fetchWalletUpstream(opts: {
  req: NextRequest;
  path: '/api/wallet' | '/api/wallet/positions';
  tradingAccountId?: string | null;
  signal: AbortSignal;
  errorFallback: string;
}): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
  errorMessage: string;
}> {
  const origin = gatewayBackendOrigin();
  const q =
    opts.tradingAccountId != null && opts.tradingAccountId !== ''
      ? `?tradingAccountId=${encodeURIComponent(opts.tradingAccountId)}`
      : '';
  const upstream = await fetch(`${origin}${opts.path}${q}`, {
    method: 'GET',
    signal: opts.signal,
    headers: {
      Accept: 'application/json',
      Cookie: opts.req.headers.get('cookie') ?? '',
    },
  });

  const text = await upstream.text();
  const body = parseUpstreamBody(text);
  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      data: null,
      errorMessage: pickUpstreamErrorMessage(body, opts.errorFallback),
    };
  }

  return {
    ok: true,
    status: upstream.status,
    data: unwrapGatewayData(body),
    errorMessage: opts.errorFallback,
  };
}
