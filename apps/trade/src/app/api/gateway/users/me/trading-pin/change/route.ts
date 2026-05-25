import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess } from '@/lib/gateway-envelope';
import { gatewayUpstreamCatch } from '@/lib/gateway-internal';
import {
  pickUpstreamErrorMessage,
  proxyUsersUpstream,
  unwrapNestData,
} from '@/lib/gateway-users-proxy';

export async function PATCH(req: NextRequest) {
  try {
    const payload = await req.json();
    const { status, body } = await proxyUsersUpstream(
      req,
      '/api/users/me/trading-pin/change',
      'PATCH',
      payload,
    );
    if (status === 401) {
      return gwResError('Chưa đăng nhập', { httpStatus: 401, ec: 401 });
    }
    if (status < 200 || status >= 300) {
      const em = pickUpstreamErrorMessage(body, 'Không đổi được mã PIN');
      return gwResError(em, { httpStatus: status, ec: status });
    }
    return gwResSuccess(unwrapNestData(body));
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ đổi PIN',
      connect: 'Lỗi kết nối máy chủ',
    });
  }
}
