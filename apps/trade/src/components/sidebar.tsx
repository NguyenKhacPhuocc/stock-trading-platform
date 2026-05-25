'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export type SidebarNavItem = {
  tabName: string;
  href: string;
  icon?: LucideIcon;
};

export type SidebarNavGroup = {
  groupLabel: string;
  items: SidebarNavItem[];
};

function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: SidebarNavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12px] transition-all duration-200 ease-out ${
        active
          ? 'bg-primary/12 font-medium text-primary shadow-[inset_3px_0_0_0_var(--primary)]'
          : 'text-muted hover:translate-x-0.5 hover:bg-surface-2 hover:text-foreground'
      }`}
    >
      {Icon ? (
        <Icon
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 transition-transform duration-200 ${
            active ? 'scale-110 text-primary' : 'group-hover:scale-105'
          }`}
        />
      ) : null}
      <span className="truncate">{item.tabName}</span>
    </Link>
  );
}

type SidebarProps = {
  items?: SidebarNavItem[];
  groups?: SidebarNavGroup[];
  title?: string;
  subtitle?: string;
  className?: string;
};

export function Sidebar({
  items = [],
  groups,
  title,
  subtitle,
  className = '',
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex w-[13.5rem] shrink-0 flex-col border-r border-border bg-surface ${className}`.trim()}
    >
      {(title || subtitle) && (
        <div className="border-b border-border px-4 py-3">
          {title ? (
            <p className="text-[12px] font-semibold tracking-wide text-foreground">{title}</p>
          ) : null}
          {subtitle ? <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p> : null}
        </div>
      )}
      <nav className="flex flex-col gap-1 overflow-y-auto p-2">
        {groups
          ? groups.map((group) => (
              <div key={group.groupLabel} className="mb-2">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary/90">
                  {group.groupLabel}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            ))
          : items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
      </nav>
    </aside>
  );
}
