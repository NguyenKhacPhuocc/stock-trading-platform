import type { NextRequest } from 'next/server';

/** Chuyển IP + User-Agent từ trình duyệt sang Nest (tránh ghi 127.0.0.1 / "node" từ fetch server). */
export function forwardClientHeaders(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};

  const ua = req.headers.get('user-agent');
  if (ua) out['user-agent'] = ua;

  const xf = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const clientIp = xf?.split(',')[0]?.trim() || realIp?.trim();
  if (clientIp) {
    out['x-forwarded-for'] = clientIp;
  }

  return out;
}
