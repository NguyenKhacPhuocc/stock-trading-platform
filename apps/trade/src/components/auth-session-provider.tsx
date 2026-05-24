'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { store } from '@/store';
import { clearUser, finishHydratingSession, setSession } from '@/store/slices/auth.slice';
import {
  AUTH_SESSION_QUERY_KEY,
  AUTH_SESSION_REFRESH_MS,
  fetchAuthenticatedSession,
} from '@/lib/fetch-auth-session';
import { TradingPinSetupModal } from '@/components/trading-pin-setup-modal';


export default function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isHydratingSession = useAppSelector((s) => s.auth.isHydratingSession);
  const hasTradingPin = useAppSelector((s) => s.auth.user?.hasTradingPin === true);
  const showPinSetup =
    isAuthenticated && !isHydratingSession && !hasTradingPin;
  const expiredNotifiedRef = useRef(false);

  const { data, isFetched, isError } = useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: fetchAuthenticatedSession,
    staleTime: AUTH_SESSION_REFRESH_MS,
    refetchInterval: isAuthenticated ? AUTH_SESSION_REFRESH_MS : false,
    refetchOnWindowFocus: isAuthenticated,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!isHydratingSession) return;
    if (isFetched || isError) dispatch(finishHydratingSession());
  }, [isFetched, isError, isHydratingSession, dispatch]);

  useEffect(() => {
    if (!isFetched) return;
    if (data) {
      expiredNotifiedRef.current = false;
      dispatch(setSession(data));
      return;
    }
    if (!store.getState().auth.isAuthenticated) return;
    if (!expiredNotifiedRef.current) {
      expiredNotifiedRef.current = true;
      toast.error('Phiên đăng nhập đã hết hạn');
    }
    dispatch(clearUser());
  }, [data, isFetched, dispatch]);

  return (
    <>
      {children}
      <TradingPinSetupModal open={showPinSetup} />
    </>
  );
}
