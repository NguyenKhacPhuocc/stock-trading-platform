'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ACCOUNT_NAV_GROUPS } from './account-nav';
import { useRequireAuth } from '@/hooks/use-require-auth';

type AccountShellProps = {
  children: ReactNode;
};

export function AccountShell({ children }: AccountShellProps) {
  const { isReady, isHydratingSession } = useRequireAuth(
    'Vui lòng đăng nhập để xem tài khoản',
  );

  if (isHydratingSession || !isReady) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <Sidebar
        groups={ACCOUNT_NAV_GROUPS}
        title="Tài khoản"
        subtitle="Tài sản & tra cứu"
      />
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}
