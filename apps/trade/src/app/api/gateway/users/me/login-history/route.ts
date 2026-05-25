import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayUpstreamCatch } from '@/lib/gateway-internal';
import {
  pickUpstreamErrorMessage,
  proxyUsersUpstream,
  unwrapNestData,
} from '@/lib/gateway-users-proxy';

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const path = `/api/users/me/login-history${qs ? `?${qs}` : ''}`;
    const { status, body } = await proxyUsersUpstream(req, path, 'GET');
    if (status === 401) {
      return gwResError('Chưa đăng nhập', { httpStatus: 401, ec: 401 });
    }
    if (status < 200 || status >= 300) {
      const em = pickUpstreamErrorMessage(body, 'Không tải lịch sử đăng nhập');
      return gwResError(em, { httpStatus: status, ec: status });
    }
    return gwResSuccess(unwrapNestData(body));
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ',
      connect: 'Lỗi kết nối máy chủ',
    });
  }
}
