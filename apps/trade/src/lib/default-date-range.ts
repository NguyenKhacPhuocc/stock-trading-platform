const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function vnYmd(ms: number): string {
  const vn = new Date(ms + VN_OFFSET_MS);
  const y = vn.getUTCFullYear();
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vn.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Khoảng 30 ngày theo lịch VN — khớp lọc `vnDateRangeToUtcBounds` trên BE. */
export function defaultAuditDateRange(): { from: string; to: string } {
  const now = Date.now();
  return {
    from: vnYmd(now - 30 * 24 * 60 * 60 * 1000),
    to: vnYmd(now),
  };
}
