/** Múi giờ Việt Nam (UTC+7) — lọc theo ngày & hiển thị. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `YYYY-MM-DD` → khoảng UTC tương ứng 00:00–23:59:59.999 theo giờ VN. */
export function vnDateRangeToUtcBounds(from?: string, to?: string): {
  start?: Date;
  end?: Date;
} {
  const out: { start?: Date; end?: Date } = {};
  if (from) {
    out.start = new Date(`${from}T00:00:00+07:00`);
  }
  if (to) {
    out.end = new Date(`${to}T23:59:59.999+07:00`);
  }
  return out;
}

/** Instant → ISO UTC (luôn có Z) cho FE. */
export function toUtcIsoString(value: Date): string {
  return value.toISOString();
}

/** Format instant UTC sang chuỗi `dd/MM/yyyy HH:mm` (giờ VN). */
export function formatInstantVN(value: Date): string {
  const vnMs = value.getTime() + VN_OFFSET_MS;
  const d = new Date(vnMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
