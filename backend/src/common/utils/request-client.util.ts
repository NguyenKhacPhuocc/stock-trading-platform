import type { Request } from 'express';

export function resolveClientIp(req: Request): string | null {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0]?.trim() ?? null;
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) {
    return real.trim();
  }
  return req.socket?.remoteAddress ?? null;
}

export function resolveClientUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua : null;
}

export function normalizeDisplayIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

export type LoginChannel = 'web' | 'app' | 'unknown';

export function loginChannelFromUserAgent(ua: string | null): LoginChannel {
  if (!ua) return 'unknown';
  const l = ua.toLowerCase();
  if (
    l.includes('okhttp') ||
    l.includes('dart/') ||
    l.includes('cfnetwork') ||
    l.includes('stock-trading-app')
  ) {
    return 'app';
  }
  if (l.includes('mozilla') || l.includes('chrome') || l.includes('safari') || l.includes('edg/')) {
    return 'web';
  }
  if (l === 'node' || l.includes('undici')) {
    return 'web';
  }
  return 'web';
}

export function loginChannelLabel(channel: LoginChannel): string {
  if (channel === 'app') return 'Ứng dụng';
  if (channel === 'web') return 'Web';
  return '—';
}
