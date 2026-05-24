'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ACCOUNT_NAV_ITEMS } from './account-nav';
import { useRequireAuth } from '@/hooks/use-require-auth';

type AccountShellProps = {
  children: ReactNode;
};

export function AccountShell({ children }: AccountShellProps) {
  const { isReady, isHydratingSession } = useRequireAuth(
    'Vui lòng đăng nhập để quản lý tài khoản',
  );

  if (isHydratingSession || !isReady) {
    return (
      <div className="flex flex-1 items-center justify-center text-[12px] text-muted">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <Sidebar
        items={ACCOUNT_NAV_ITEMS}
        title="Tài khoản"
        subtitle="Quản lý hồ sơ & bảo mật"
      />
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
