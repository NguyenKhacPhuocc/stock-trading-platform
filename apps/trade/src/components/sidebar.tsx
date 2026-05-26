'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export type SidebarNavChild = {
  tabName: string;
  href: string;
};

export type SidebarNavItem = {
  tabName: string;
  href?: string;
  icon?: LucideIcon;
  /** Chỉ active khi path khớp đúng (vd. `/account` không active trên `/account/holdings`). */
  exact?: boolean;
  children?: SidebarNavChild[];
};

export type SidebarNavGroup = {
  groupLabel: string;
  items: SidebarNavItem[];
};

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (pathname === href) return true;
  if (exact) return false;
  return pathname.startsWith(`${href}/`);
}

function childGroupActive(pathname: string, children: SidebarNavChild[]): boolean {
  return children.some((c) => isActivePath(pathname, c.href));
}

function NavLink({
  item,
  pathname,
  indent = false,
}: {
  item: { tabName: string; href: string; exact?: boolean };
  pathname: string;
  indent?: boolean;
}) {
  const active = isActivePath(pathname, item.href, item.exact);
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-2 rounded-lg py-2 text-sm transition-all duration-200 ease-out ${
        indent ? 'pl-9 pr-3' : 'px-3'
      } ${
        active
          ? 'bg-primary/12 font-medium text-primary shadow-[inset_3px_0_0_0_var(--primary)]'
          : 'text-muted hover:bg-surface-2 hover:text-foreground'
      }`}
    >
      <span className="truncate">{item.tabName}</span>
    </Link>
  );
}

function NavItemWithChildren({
  item,
  pathname,
}: {
  item: SidebarNavItem;
  pathname: string;
}) {
  const children = item.children ?? [];
  const groupActive = childGroupActive(pathname, children);
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? groupActive;

  const Icon = item.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpenOverride(!open)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
          groupActive
            ? 'bg-primary/8 font-medium text-primary'
            : 'text-muted hover:bg-surface-2 hover:text-foreground'
        }`}
      >
        {Icon ? (
          <Icon
            size={16}
            strokeWidth={1.75}
            className={`shrink-0 ${groupActive ? 'text-primary' : ''}`}
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate">{item.tabName}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {children.map((child) => (
            <NavLink key={child.href} item={child} pathname={pathname} indent />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavItem({ item, pathname }: { item: SidebarNavItem; pathname: string }) {
  if (item.children && item.children.length > 0) {
    return <NavItemWithChildren item={item} pathname={pathname} />;
  }
  if (!item.href) return null;
  const Icon = item.icon;
  const active = isActivePath(pathname, item.href, item.exact);
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ease-out ${
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
            <p className="text-sm font-semibold tracking-wide text-foreground">{title}</p>
          ) : null}
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
      )}
      <nav className="flex flex-col gap-1 overflow-y-auto p-2">
        {groups
          ? groups.map((group) => (
              <div key={group.groupLabel} className="mb-2">
                <p className="px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-primary/90">
                  {group.groupLabel}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <NavItem key={item.tabName} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            ))
          : items.map((item) => (
              <NavItem key={item.tabName} item={item} pathname={pathname} />
            ))}
      </nav>
    </aside>
  );
}
