export type RealtimeEnvelope<TData = unknown> = {
  type: string;
  seq: number;
  ts: string;
  data: TData;
};

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
