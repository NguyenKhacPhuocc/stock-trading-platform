import { KeyRound, UserRound } from 'lucide-react';
import type { SidebarNavItem } from '@/components/sidebar';

export const ACCOUNT_NAV_ITEMS: SidebarNavItem[] = [
  { tabName: 'Thông tin cá nhân', href: '/account/info', icon: UserRound },
  { tabName: 'Đổi mật khẩu', href: '/account/password', icon: KeyRound },
];
