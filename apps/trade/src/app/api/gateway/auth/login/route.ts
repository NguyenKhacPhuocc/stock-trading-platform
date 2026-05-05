import { NextRequest } from 'next/server';
import { appendSetCookies, gwResError, gwResSuccess } from '@/lib/gateway-envelope';

const AUTH_TIMEOUT_MS = 10_000;

function backendOrigin(): string {
  const raw = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3002';
  return raw.replace(/\/?$/, '');
}

export async function POST(req: NextRequest) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AUTH_TIMEOUT_MS);

  try {
    const body = await req.text();

    const nestRes = await fetch(`${backendOrigin()}/api/auth/login`, {
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
    const aborted = e instanceof Error && e.name === 'AbortError';
    const em = aborted ? 'Hết thời gian chờ đăng nhập' : 'Lỗi kết nối tới máy chủ';
    return gwResError(em, { httpStatus: 504, ec: 504 });
  } finally {
    clearTimeout(timer);
  }
}
