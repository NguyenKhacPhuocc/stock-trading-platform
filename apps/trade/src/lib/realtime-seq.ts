export type SeqState = Record<string, number>;

export type SeqCheckResult =
  | { ok: true; nextSeq: number }
  | { ok: false; reason: 'duplicate_or_old' | 'gap' };

/**
 * Kiểm tra seq cho một stream key (vd: symbol/account).
 */
export function checkSeq(
  state: SeqState,
  streamKey: string,
  incomingSeq: number,
): SeqCheckResult {
  const lastSeq = state[streamKey];
  if (typeof lastSeq !== 'number') {
    return { ok: true, nextSeq: incomingSeq };
  }
  if (incomingSeq <= lastSeq) {
    return { ok: false, reason: 'duplicate_or_old' };
  }
  if (incomingSeq > lastSeq + 1) {
    return { ok: false, reason: 'gap' };
  }
  return { ok: true, nextSeq: incomingSeq };
}
