import {
  Bell,
  History,
  KeyRound,
  LockKeyhole,
  Phone,
  Settings2,
  UserRound,
} from 'lucide-react';
import type { SidebarNavGroup } from '@/components/sidebar';

export const SETTINGS_NAV_GROUPS: SidebarNavGroup[] = [
  {
    groupLabel: 'CÁ NHÂN',
    items: [
      { tabName: 'Thông tin cá nhân', href: '/settings/personal-info', icon: UserRound },
      { tabName: 'Đổi mật khẩu', href: '/settings/change-password', icon: KeyRound },
      { tabName: 'Đổi mã PIN', href: '/settings/change-pin', icon: LockKeyhole },
    ],
  },
  {
    groupLabel: 'TRA CỨU',
    items: [
      { tabName: 'Lịch sử đăng nhập', href: '/settings/login-history', icon: History },
      {
        tabName: 'Lịch sử thay đổi TT',
        href: '/settings/profile-history',
        icon: History,
      },
    ],
  },
  {
    groupLabel: 'CẤU HÌNH',
    items: [
      { tabName: 'Cấu hình chung', href: '/settings/general-config', icon: Settings2 },
      {
        tabName: 'Thiết lập thông báo',
        href: '/settings/notify-account',
        icon: Bell,
      },
    ],
  },
  {
    groupLabel: 'LIÊN HỆ',
    items: [{ tabName: 'Liên hệ', href: '/settings/contact', icon: Phone }],
  },
];
