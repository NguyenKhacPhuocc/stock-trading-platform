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
    const { status, body } = await proxyUsersUpstream(req, '/api/users/me', 'GET');
    if (status === 401) {
      return gwResError('Chưa đăng nhập', { httpStatus: 401, ec: 401 });
    }
    if (status < 200 || status >= 300) {
      const em = pickUpstreamErrorMessage(body, 'Không tải được hồ sơ');
      return gwResError(em, { httpStatus: status, ec: status });
    }
    return gwResSuccess(unwrapNestData(body));
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ hồ sơ',
      connect: 'Lỗi kết nối máy chủ',
    });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await req.json();
    const { status, body } = await proxyUsersUpstream(
      req,
      '/api/users/me',
      'PATCH',
      payload,
    );
    if (status === 401) {
      return gwResError('Chưa đăng nhập', { httpStatus: 401, ec: 401 });
    }
    if (status < 200 || status >= 300) {
      const em = pickUpstreamErrorMessage(body, 'Không cập nhật được hồ sơ');
      return gwResError(em, { httpStatus: status, ec: status });
    }
    return gwResSuccess(unwrapNestData(body));
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ cập nhật hồ sơ',
      connect: 'Lỗi kết nối máy chủ',
    });
  }
}
