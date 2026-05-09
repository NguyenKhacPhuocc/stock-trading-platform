import { gwResError } from '@/lib/gateway-envelope';

export function gatewayBackendOrigin(): string {
  const raw = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3002';
  return raw.replace(/\/$/, '');
}

/** 504 chỉ khi AbortError timeout; các lỗi khác trả 502. */
export function gatewayUpstreamCatch(
  err: unknown,
  messages: { timeout: string; connect: string },
) {
  const aborted = err instanceof Error && err.name === 'AbortError';
  if (aborted) {
    return gwResError(messages.timeout, { httpStatus: 504, ec: 504 });
  }
  return gwResError(messages.connect, { httpStatus: 502, ec: 502 });
}
