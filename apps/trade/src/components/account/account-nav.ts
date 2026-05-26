import {
  ClipboardList,
  History,
  LayoutDashboard,
  LineChart,
  PieChart,
} from 'lucide-react';
import type { SidebarNavGroup } from '@/components/sidebar';

/** Sidebar tab Tài khoản — nhóm TÀI KHOẢN + TRA CỨU (BVSC). */
export const ACCOUNT_NAV_GROUPS: SidebarNavGroup[] = [
  {
    groupLabel: 'TÀI KHOẢN',
    items: [
      {
        tabName: 'Tổng hợp tài sản',
        href: '/account',
        icon: LayoutDashboard,
        exact: true,
      },
      {
        tabName: 'Danh mục đầu tư',
        href: '/account/holdings',
        icon: PieChart,
      },
      {
        tabName: 'Lãi/lỗ đã thực hiện',
        href: '/account/pnl/realized',
        icon: LineChart,
      },
    ],
  },
  {
    groupLabel: 'TRA CỨU',
    items: [
      {
        tabName: 'Lịch sử lệnh',
        href: '/account/orders',
        icon: History,
      },
      {
        tabName: 'Sao kê cổ phiếu',
        href: '/account/stock-ledger',
        icon: ClipboardList,
      },
    ],
  },
];
