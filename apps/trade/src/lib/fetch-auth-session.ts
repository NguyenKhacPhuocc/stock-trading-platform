import { bffClient } from '@stock/utils';
import { GATEWAY_AUTH } from '@/lib/gateway-paths';
import { mapAuthUserPayload } from '@/lib/map-auth-user';
import { mapTradingAccountsEnvelope } from '@/lib/map-trading-accounts-api';
import type { AuthUser, TradingAccountSummary } from '@/store/slices/auth.slice';

/**
 * Đồng bộ session: GET /trade/api/gateway/auth/session → { user, accounts }.
 * BFF gom /auth/me + /users/me/accounts nội bộ.
 * Dùng sau login và khi F5 (AuthSessionProvider).
 */
export async function fetchAuthenticatedSession(): Promise<{
  user: AuthUser;
  tradingAccounts: TradingAccountSummary[];
} | null> {
  const res = await bffClient.get(GATEWAY_AUTH.session);
  const d = res.data?.d as { user?: unknown; accounts?: unknown } | null;
  if (!d) return null;

  const user = mapAuthUserPayload(d.user);
  if (!user) return null;

  const tradingAccounts = mapTradingAccountsEnvelope(d.accounts);
  return { user, tradingAccounts };
}
