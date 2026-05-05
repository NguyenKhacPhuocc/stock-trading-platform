import type { ApiErrorEnvelope, ApiOkEnvelope } from '@stock/types';
import { NextResponse } from 'next/server';

export function gwResSuccess<T>(d: T): NextResponse<ApiOkEnvelope<T>> {
  return NextResponse.json({ s: 'ok', ec: 0, em: '', d });
}

export function gwResError(
  em: string,
  options?: { httpStatus?: number; ec?: number },
): NextResponse<ApiErrorEnvelope> {
  const httpStatus = options?.httpStatus ?? 502;
  const ec = options?.ec ?? httpStatus;
  return NextResponse.json({ s: 'error', ec, em, d: null }, { status: httpStatus });
}

/**
 * Chuyển tiếp tất cả Set-Cookie header từ Nest response sang BFF NextResponse.
 * Dùng `getSetCookie()` (WHATWG Headers) nếu runtime hỗ trợ; fallback sang raw string.
 */
export function appendSetCookies(bffRes: NextResponse, nestHeaders: Headers): void {
  const cookies: string[] =
    typeof (nestHeaders as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (nestHeaders as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : nestHeaders.get('set-cookie')
        ? [nestHeaders.get('set-cookie')!]
        : [];
  for (const c of cookies) {
    bffRes.headers.append('set-cookie', c);
  }
}

/** Body JSON từ Nest (array thuần hoặc bọc `{ s, d }`) → mảng trong `d` hoặc root */
export function unwrapNestArrayPayload(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object' && 'd' in json) {
    const d = (json as { d: unknown }).d;
    if (Array.isArray(d)) return d;
  }
  return [];
}
