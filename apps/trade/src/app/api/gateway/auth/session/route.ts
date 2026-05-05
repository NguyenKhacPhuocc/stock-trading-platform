import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';

const AUTH_TIMEOUT_MS = 10_000;

function backendOrigin(): string {
  const raw = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3002';
  return raw.replace(/\/?$/, '');
}

/**
 * GET /trade/api/gateway/auth/session
 * Gom GET /api/auth/me + GET /api/users/me/accounts thành một lần gọi cho FE.
 * 401 khi chưa đăng nhập → trả 401 để FE tự xử lý.
 */
export async function GET(req: NextRequest) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AUTH_TIMEOUT_MS);

  const cookieHeader = req.headers.get('cookie') ?? '';
  const origin = backendOrigin();
  const sharedHeaders = {
    Accept: 'application/json',
    Cookie: cookieHeader,
  };

  try {
    const meRes = await fetch(`${origin}/api/auth/me`, {
      headers: sharedHeaders,
      signal: ac.signal,
    });

    if (meRes.status === 401) {
      return gwResError('Chưa đăng nhập', { httpStatus: 401, ec: 401 });
    }

    if (!meRes.ok) {
      return gwResError('Không lấy được thông tin phiên', { httpStatus: 502, ec: 502 });
    }

    const meJson = await meRes.json();
    const user = meJson?.d?.user ?? meJson?.d ?? null;

    const accRes = await fetch(`${origin}/api/users/me/accounts`, {
      headers: sharedHeaders,
      signal: ac.signal,
    });

    let accounts: unknown = null;
    if (accRes.ok) {
      const accJson = await accRes.json();
      accounts = accJson?.d ?? null;
    }

    return gwResSuccess({ user, accounts });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    const em = aborted ? 'Hết thời gian chờ tải phiên' : 'Lỗi kết nối tới máy chủ';
    return gwResError(em, { httpStatus: 504, ec: 504 });
  } finally {
    clearTimeout(timer);
  }
}
