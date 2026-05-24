import type { NextRequest } from 'next/server';
import { gatewayBackendOrigin } from '@/lib/gateway-internal';

const USERS_TIMEOUT_MS = 10_000;

export function parseUpstreamJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function unwrapNestData(body: unknown): unknown {
  if (body && typeof body === 'object' && 'd' in body) {
    return (body as { d: unknown }).d;
  }
  return body;
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

export async function proxyUsersUpstream(
  req: NextRequest,
  nestPath: string,
  method: 'GET' | 'PATCH',
  jsonBody?: unknown,
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), USERS_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Cookie: req.headers.get('cookie') ?? '',
    };
    if (jsonBody !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${gatewayBackendOrigin()}${nestPath}`, {
      method,
      signal: ac.signal,
      headers,
      body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: parseUpstreamJson(text), headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}
