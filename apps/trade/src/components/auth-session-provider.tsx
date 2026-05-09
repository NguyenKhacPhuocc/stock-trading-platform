'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { finishHydratingSession, setSession } from '@/store/slices/auth.slice';
import { fetchAuthenticatedSession } from '@/lib/fetch-auth-session';

let inflightSessionHydration: ReturnType<
  typeof fetchAuthenticatedSession
> | null = null;

async function fetchAuthenticatedSessionOnce() {
  if (!inflightSessionHydration) {
    inflightSessionHydration = fetchAuthenticatedSession().finally(() => {
      inflightSessionHydration = null;
    });
  }
  return inflightSessionHydration;
}

/**
 * Sau F5: GET /auth/me + GET /users/me/accounts → Redux.
 * 401 = chưa đăng nhập, không báo lỗi.
 */
export default function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await fetchAuthenticatedSessionOnce();
        if (!cancelled && session) dispatch(setSession(session));
      } catch {
        // 401 / lỗi mạng: không clearUser — tránh race với login; sau F5 Redux đã null
      } finally {
        if (!cancelled) dispatch(finishHydratingSession());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return <>{children}</>;
}
