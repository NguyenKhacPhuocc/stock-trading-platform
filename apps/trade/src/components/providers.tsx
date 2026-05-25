'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/store';
import { queryClient } from '@stock/utils';
import AuthSessionProvider from '@/components/auth-session-provider';
import SessionHydrationGate from '@/components/session-hydration-gate';
import { TradeRealtimeProvider } from '@/components/trade-realtime-provider';
import { OrderNotificationsListener } from '@/components/order-notifications-listener';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <TradeRealtimeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthSessionProvider>
            <SessionHydrationGate>
              <OrderNotificationsListener />
              {children}
            </SessionHydrationGate>
            <Toaster richColors position="bottom-right" closeButton duration={5000} />
          </AuthSessionProvider>
        </QueryClientProvider>
      </TradeRealtimeProvider>
    </ReduxProvider>
  );
}
