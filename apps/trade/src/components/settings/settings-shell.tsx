'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { SETTINGS_NAV_GROUPS } from './settings-nav';
import { useRequireAuth } from '@/hooks/use-require-auth';

type SettingsShellProps = {
  children: ReactNode;
};

export function SettingsShell({ children }: SettingsShellProps) {
  const { isReady, isHydratingSession } = useRequireAuth(
    'Vui lòng đăng nhập để mở thiết lập',
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
        groups={SETTINGS_NAV_GROUPS}
        title="Thiết lập"
        subtitle="Hồ sơ & bảo mật"
      />
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
