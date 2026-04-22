'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/store';
import { queryClient } from '@stock/utils';
import AuthSessionProvider from '@/components/auth-session-provider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <AuthSessionProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </AuthSessionProvider>
    </ReduxProvider>
  );
}
