import { apiClient } from '@stock/utils';
import { mapAuthUserPayload } from '@/lib/map-auth-user';
import { mapTradingAccountsEnvelope } from '@/lib/map-trading-accounts-api';
import type { AuthUser, TradingAccountSummary } from '@/store/slices/auth.slice';

/**
 * Đồng bộ session: GET /auth/me + GET /users/me/accounts (cookie đã có access).
 * Dùng sau login và khi F5 (AuthSessionProvider).
 */
export async function fetchAuthenticatedSession(): Promise<{
  user: AuthUser;
  tradingAccounts: TradingAccountSummary[];
} | null> {
  const meRes = await apiClient.get('/auth/me');
  const d = meRes.data?.d;
  const rawUser =
    d && typeof d === 'object' && 'user' in d
      ? (d as { user: unknown }).user
      : d;
  const user = mapAuthUserPayload(rawUser);
  if (!user) return null;

  const accRes = await apiClient.get('/users/me/accounts');
  const tradingAccounts = mapTradingAccountsEnvelope(accRes.data?.d);
  return { user, tradingAccounts };
}
