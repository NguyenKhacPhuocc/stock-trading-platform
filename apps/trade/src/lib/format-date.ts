/**
 * Format ISO timestamp sang HH:mm:ss (VN time)
 */
export function formatTimeHHmmss(isoString: string | Date): string {
  try {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    if (isNaN(date.getTime())) return '--:--:--';
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch {
    return '--:--:--';
  }
}

/**
 * Format ISO timestamp sang DD/MM HH:mm
 */
/** Ngày sinh / date-only: DD/MM/YYYY */
export function formatDateOnly(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) return '—';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  } catch {
    return '—';
  }
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse instant từ API (ưu tiên ISO có `Z` từ backend). */
export function parseApiInstant(value: string | Date): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  const s = String(value).trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** Ngày giờ đầy đủ theo múi giờ Việt Nam (UTC+7 / GMT+7). */
export function formatDateTimeVN(isoString: string | Date): string {
  const ms = parseApiInstant(isoString);
  if (ms == null) return '—';
  const vn = new Date(ms + VN_OFFSET_MS);
  return `${pad2(vn.getUTCDate())}/${pad2(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ${pad2(vn.getUTCHours())}:${pad2(vn.getUTCMinutes())}`;
}

export function formatDateTimeCompact(isoString: string | Date): string {
  try {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    if (isNaN(date.getTime())) return '--/-- --:--';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m} ${h}:${min}`;
  } catch {
    return '--/-- --:--';
  }
}
