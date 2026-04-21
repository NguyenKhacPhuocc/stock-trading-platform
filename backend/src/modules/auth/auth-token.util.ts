import { createHash, randomBytes } from 'crypto';

/** Chuỗi ngẫu nhiên URL-safe làm refresh token (opaque) */
export function generateOpaqueRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

/**
 * Parse TTL kiểu "15m", "7d", "24h", "3600s" → milliseconds (fallback 15 phút).
 */
export function ttlToMs(ttl: string | undefined): number {
  if (!ttl || typeof ttl !== 'string') return 15 * 60 * 1000;
  const m = ttl.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  const mult: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return n * (mult[u] ?? 60_000);
}
