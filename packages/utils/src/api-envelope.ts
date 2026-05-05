import type { ApiErrorEnvelope, ApiOkEnvelope } from '@stock/types';

export type ParseApiEnvelopeOk<T> = { ok: true; d: T };
export type ParseApiEnvelopeFail = { ok: false; em: string; ec: number };

/**
 * Parse JSON body envelope (Nest / Next gateway) sau `await res.json()`.
 * Dùng chung FE (fetch) và có thể tái dùng cho axios nếu cần.
 */
export function parseApiEnvelopeJson<T = unknown>(
  json: unknown,
): ParseApiEnvelopeOk<T> | ParseApiEnvelopeFail {
  if (!json || typeof json !== 'object') {
    return { ok: false, em: 'Phản hồi không hợp lệ', ec: 502 };
  }
  const r = json as Record<string, unknown>;
  if (r.s === 'ok' && r.ec === 0 && 'd' in r) {
    return { ok: true, d: r.d as T };
  }
  if (r.s === 'error') {
    const em = typeof r.em === 'string' && r.em.trim() ? r.em : 'Lỗi';
    const ec = typeof r.ec === 'number' ? r.ec : 500;
    return { ok: false, em, ec };
  }
  return { ok: false, em: 'Phản hồi không hợp lệ', ec: 502 };
}

export function isApiOkEnvelope<T>(v: unknown): v is ApiOkEnvelope<T> {
  return (
    !!v &&
    typeof v === 'object' &&
    (v as ApiOkEnvelope<T>).s === 'ok' &&
    (v as ApiOkEnvelope<T>).ec === 0 &&
    'd' in (v as object)
  );
}

export function isApiErrorEnvelope(v: unknown): v is ApiErrorEnvelope {
  return (
    !!v &&
    typeof v === 'object' &&
    (v as ApiErrorEnvelope).s === 'error' &&
    typeof (v as ApiErrorEnvelope).em === 'string'
  );
}
