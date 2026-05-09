import { NextRequest } from 'next/server';
import { appendSetCookies, gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayBackendOrigin, gatewayUpstreamCatch } from '@/lib/gateway-internal';

const AUTH_TIMEOUT_MS = 10_000;

export async function POST(req: NextRequest) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AUTH_TIMEOUT_MS);

  try {
    const body = await req.text();

    const nestRes = await fetch(`${gatewayBackendOrigin()}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: req.headers.get('cookie') ?? '',
      },
      body,
      signal: ac.signal,
    });

    const nestJson = await nestRes.json();

    if (!nestRes.ok) {
      const em = nestJson?.em ?? nestJson?.message ?? 'Đăng nhập thất bại';
      return gwResError(em, { httpStatus: nestRes.status, ec: nestJson?.ec ?? nestRes.status });
    }

    // Trả user về FE (không expose accessToken/refreshToken trong body)
    const user = nestJson?.d?.user ?? nestJson?.user;
    const bffRes = gwResSuccess({ user });
    appendSetCookies(bffRes, nestRes.headers);
    return bffRes;
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ đăng nhập',
      connect: 'Lỗi kết nối tới máy chủ',
    });
  } finally {
    clearTimeout(timer);
  }
}
