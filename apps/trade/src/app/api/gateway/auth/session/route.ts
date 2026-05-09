import { NextRequest } from 'next/server';
import { appendSetCookies, gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayBackendOrigin, gatewayUpstreamCatch } from '@/lib/gateway-internal';

const AUTH_TIMEOUT_MS = 10_000;

/**
 * GET /trade/api/gateway/auth/session
 * Gom GET /api/auth/me + GET /api/users/me/accounts thành một lần gọi cho FE.
 * 401 khi chưa đăng nhập → trả 401 để FE tự xử lý.
 */
export async function GET(req: NextRequest) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AUTH_TIMEOUT_MS);

  const cookieHeader = req.headers.get('cookie') ?? '';
  const origin = gatewayBackendOrigin();
  const sharedHeaders = {
    Accept: 'application/json',
    Cookie: cookieHeader,
  };

  try {
    const callMe = () =>
      fetch(`${origin}/api/auth/me`, {
        headers: sharedHeaders,
        signal: ac.signal,
      });

    let meRes = await callMe();

    if (meRes.status === 401) {
      const hasRefreshToken = /(?:^|;\s*)refresh_token=/.test(cookieHeader);
      if (!hasRefreshToken) {
        return gwResError('Chưa đăng nhập', { httpStatus: 401, ec: 401 });
      }

      const refreshRes = await fetch(`${origin}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          ...sharedHeaders,
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: ac.signal,
      });

      if (!refreshRes.ok) {
        return gwResError('Phiên hết hạn, vui lòng đăng nhập lại', {
          httpStatus: 401,
          ec: 401,
        });
      }

      const refreshJson = await refreshRes.json().catch(() => null);
      const refreshedAccessToken =
        refreshJson?.d?.accessToken ?? refreshJson?.accessToken ?? null;
      const meHeaders =
        typeof refreshedAccessToken === 'string' && refreshedAccessToken.length > 0
          ? { ...sharedHeaders, Authorization: `Bearer ${refreshedAccessToken}` }
          : sharedHeaders;

      meRes = await fetch(`${origin}/api/auth/me`, {
        headers: meHeaders,
        signal: ac.signal,
      });
      if (meRes.status === 401) {
        return gwResError('Chưa đăng nhập', { httpStatus: 401, ec: 401 });
      }

      if (!meRes.ok) {
        return gwResError('Không lấy được thông tin phiên', {
          httpStatus: 502,
          ec: 502,
        });
      }

      const meJson = await meRes.json();
      const user = meJson?.d?.user ?? meJson?.d ?? null;

      const accRes = await fetch(`${origin}/api/users/me/accounts`, {
        headers: meHeaders,
        signal: ac.signal,
      });

      let accounts: unknown = null;
      if (accRes.ok) {
        const accJson = await accRes.json();
        accounts = accJson?.d ?? null;
      }

      const bffRes = gwResSuccess({ user, accounts });
      appendSetCookies(bffRes, refreshRes.headers);
      return bffRes;
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
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ tải phiên',
      connect: 'Lỗi kết nối tới máy chủ',
    });
  } finally {
    clearTimeout(timer);
  }
}
