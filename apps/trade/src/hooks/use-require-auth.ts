'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearUser } from '@/store/slices/auth.slice';

/**
 * Guard trang cần đăng nhập: redirect nếu chưa auth sau khi hydrate xong.
 * Không poll phiên — refresh định kỳ nằm ở `AuthSessionProvider` + `fetch-auth-session.ts`.
 */
export function useRequireAuth(loginMessage = 'Vui lòng đăng nhập') {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isHydratingSession = useAppSelector((s) => s.auth.isHydratingSession);
  const authUser = useAppSelector((s) => s.auth.user);
  const redirectedUnauthRef = useRef(false);

  const handleSessionExpired = useCallback(() => {
    dispatch(clearUser());
    toast.error('Phiên đăng nhập đã hết hạn');
    router.replace('/priceboard');
  }, [dispatch, router]);

  useEffect(() => {
    if (!isHydratingSession && !isAuthenticated && !redirectedUnauthRef.current) {
      redirectedUnauthRef.current = true;
      toast.info(loginMessage);
      router.replace('/priceboard');
    }
  }, [isHydratingSession, isAuthenticated, loginMessage, router]);

  const isReady = !isHydratingSession && isAuthenticated;

  return { isReady, isHydratingSession, authUser, handleSessionExpired };
}
