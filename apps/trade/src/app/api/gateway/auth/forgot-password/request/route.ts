import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayBackendOrigin, gatewayUpstreamCatch } from '@/lib/gateway-internal';

const TIMEOUT_MS = 10_000;

export async function POST(req: NextRequest) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const body = await req.text();
    const nestRes = await fetch(
      `${gatewayBackendOrigin()}/api/auth/forgot-password/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
        signal: ac.signal,
      },
    );
    const nestJson = await nestRes.json();
    if (!nestRes.ok) {
      const em = nestJson?.em ?? nestJson?.message ?? 'Không gửi được yêu cầu';
      return gwResError(em, { httpStatus: nestRes.status, ec: nestJson?.ec ?? nestRes.status });
    }
    return gwResSuccess(nestJson?.d ?? nestJson);
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ máy chủ',
      connect: 'Lỗi kết nối tới máy chủ',
    });
  } finally {
    clearTimeout(timer);
  }
}
