import axios from 'axios';
import { bffClient } from '@stock/utils';
import { GATEWAY_AUTH } from '@/lib/gateway-paths';
import { mapAuthUserPayload } from '@/lib/map-auth-user';
import { mapTradingAccountsEnvelope } from '@/lib/map-trading-accounts-api';
import type { AuthUser, TradingAccountSummary } from '@/store/slices/auth.slice';

/** React Query key + chu kỳ làm mới session (access JWT ~15m). */
export const AUTH_SESSION_QUERY_KEY = ['auth', 'session'] as const;
export const AUTH_SESSION_REFRESH_MS = 5 * 60 * 1000;

export type AuthenticatedSession = {
  user: AuthUser;
  tradingAccounts: TradingAccountSummary[];
};

/**
 * Đồng bộ session: GET /trade/api/gateway/auth/session → { user, accounts }.
 * BFF gom /auth/me + /users/me/accounts nội bộ (có refresh token nếu cần).
 * Trả null khi 401 / chưa đăng nhập.
 */
export async function fetchAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  try {
    const res = await bffClient.get(GATEWAY_AUTH.session);
    if (res.status === 401 || res.data?.s === 'error') return null;

    const d = res.data?.d as { user?: unknown; accounts?: unknown } | null;
    if (!d) return null;

    const user = mapAuthUserPayload(d.user);
    if (!user) return null;

    const tradingAccounts = mapTradingAccountsEnvelope(d.accounts);
    return { user, tradingAccounts };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) return null;
    throw err;
  }
}
