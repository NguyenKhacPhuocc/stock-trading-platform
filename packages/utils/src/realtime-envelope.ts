import type { RealtimeEnvelope } from '@stock/types';

export type ParseRealtimeEnvelopeOk<TData> = {
  ok: true;
  event: RealtimeEnvelope<TData>;
};

export type ParseRealtimeEnvelopeFail = {
  ok: false;
  error: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * Parse payload WS theo envelope chuẩn `{ type, seq, ts, data }`.
 */
export function parseRealtimeEnvelope<TData = unknown>(
  raw: unknown,
): ParseRealtimeEnvelopeOk<TData> | ParseRealtimeEnvelopeFail {
  if (!isRecord(raw)) return { ok: false, error: 'Event không hợp lệ' };

  const type = raw.type;
  const seq = raw.seq;
  const ts = raw.ts;

  if (typeof type !== 'string' || type.trim() === '') {
    return { ok: false, error: 'Thiếu type hợp lệ' };
  }
  if (typeof seq !== 'number' || !Number.isFinite(seq) || seq < 0) {
    return { ok: false, error: 'Thiếu seq hợp lệ' };
  }
  if (typeof ts !== 'string' || ts.trim() === '') {
    return { ok: false, error: 'Thiếu ts hợp lệ' };
  }
  if (!('data' in raw)) {
    return { ok: false, error: 'Thiếu data' };
  }

  return {
    ok: true,
    event: {
      type,
      seq,
      ts,
      data: raw.data as TData,
    },
  };
}

export function buildRealtimeEnvelope<TData>(input: {
  type: string;
  seq: number;
  data: TData;
  ts?: string;
}): RealtimeEnvelope<TData> {
  return {
    type: input.type,
    seq: input.seq,
    ts: input.ts ?? new Date().toISOString(),
    data: input.data,
  };
}
