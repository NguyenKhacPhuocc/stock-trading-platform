import type { NextRequest } from 'next/server';
import { gatewayBackendOrigin } from '@/lib/gateway-internal';
import {
  parseUpstreamBody,
  pickUpstreamErrorMessage,
  unwrapGatewayData,
} from '@/lib/gateway-wallet-upstream';

export async function fetchBackendUpstream(opts: {
  req: NextRequest;
  path: string;
  method?: 'GET' | 'PATCH' | 'POST';
  body?: unknown;
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
      ? `${opts.path.includes('?') ? '&' : '?'}tradingAccountId=${encodeURIComponent(opts.tradingAccountId)}`
      : '';
  const upstream = await fetch(`${origin}${opts.path}${q}`, {
    method: opts.method ?? 'GET',
    signal: opts.signal,
    headers: {
      Accept: 'application/json',
      Cookie: opts.req.headers.get('cookie') ?? '',
      ...(opts.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
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
