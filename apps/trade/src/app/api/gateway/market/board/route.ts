import { NextRequest } from 'next/server';
import { gwResError, gwResSuccess, unwrapNestArrayPayload } from '@/lib/gateway-envelope';
import { gatewayBackendOrigin, gatewayUpstreamCatch } from '@/lib/gateway-internal';

const MARKET_TIMEOUT_MS = 15_000;

export async function GET(req: NextRequest) {
  const exchange = req.nextUrl.searchParams.get('exchange') ?? undefined;
  const withQuotes = req.nextUrl.searchParams.get('quote') === 'true';
  const origin = gatewayBackendOrigin();

  const insUrl = new URL(`${origin}/api/market/instruments`);
  if (exchange && exchange !== 'ALL') insUrl.searchParams.set('exchange', exchange);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), MARKET_TIMEOUT_MS);

  try {
    const insRes = await fetch(insUrl, {
      signal: ac.signal,
      headers: { Accept: 'application/json' },
    });

    if (!insRes.ok) {
      const em =
        insRes.status >= 500
          ? 'Máy chủ dữ liệu thị trường tạm không phản hồi'
          : 'Không tải được danh sách mã';
      return gwResError(em, { httpStatus: 502, ec: 502 });
    }

    const insJson = await insRes.json();
    const instruments = unwrapNestArrayPayload(insJson);

    if (!withQuotes) {
      return gwResSuccess({ instruments });
    }

    const quotesUrl = new URL(`${origin}/api/market/quotes`);
    quotesUrl.searchParams.set('symbols', 'ALL');
    const quotesRes = await fetch(quotesUrl, {
      signal: ac.signal,
      headers: { Accept: 'application/json' },
    });

    if (!quotesRes.ok) {
      const em =
        quotesRes.status >= 500
          ? 'Máy chủ dữ liệu thị trường tạm không phản hồi'
          : 'Không tải được bộ mã tìm kiếm';
      return gwResError(em, { httpStatus: 502, ec: 502 });
    }

    const quotesJson = await quotesRes.json();
    const quotes = unwrapNestArrayPayload(quotesJson);

    return gwResSuccess({ instruments, quotes });
  } catch (e) {
    return gatewayUpstreamCatch(e, {
      timeout: 'Hết thời gian chờ dữ liệu thị trường',
      connect: 'Lỗi kết nối tới máy chủ nội bộ',
    });
  } finally {
    clearTimeout(timer);
  }
}
