'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/store';
import { queryClient } from '@stock/utils';
import AuthSessionProvider from '@/components/auth-session-provider';
import SessionHydrationGate from '@/components/session-hydration-gate';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <AuthSessionProvider>
        <QueryClientProvider client={queryClient}>
          <SessionHydrationGate>{children}</SessionHydrationGate>
          <Toaster richColors position="bottom-right" closeButton duration={5000} />
        </QueryClientProvider>
      </AuthSessionProvider>
    </ReduxProvider>
  );
}
