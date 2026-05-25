'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, UserRoundCog } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { clearUser, setSelectedTradingAccountId } from '@/store/slices/auth.slice';
import { bffClient, queryClient } from '@stock/utils';
import { GATEWAY_AUTH } from '@/lib/gateway-paths';
import { AUTH_SESSION_QUERY_KEY } from '@/lib/fetch-auth-session';
import AuthPopup from './auth-popup';
import { NotificationBell } from './notification-bell';

type LocalePref = 'vi' | 'en';
type ThemePref = 'dark' | 'light';

type SettingsTripleOption = {
  value: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
};

function SettingsTripleRow({
  title,
  name,
  options,
  className = '',
}: {
  title: string;
  name: string;
  options: [SettingsTripleOption, SettingsTripleOption];
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-3 items-center gap-0 px-2 py-2 text-[12px] ${className}`.trim()}
    >
      <span className="justify-self-start text-left text-muted">{title}</span>
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex w-full cursor-pointer items-center justify-start gap-1 text-left hover:bg-surface-2"
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={opt.checked}
            onChange={opt.onSelect}
            className="accent-[var(--primary)]"
          />
          <span className="whitespace-nowrap text-foreground">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function TradeHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [tradingMenuOpen, setTradingMenuOpen] = useState(false);
  const tradingMenuRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [localePref, setLocalePref] = useState<LocalePref>('vi');
  const [themePref, setThemePref] = useState<ThemePref>('dark');

  const activeTradingAccounts = tradingAccounts.filter((a) => a.status === 'ACTIVE');
  const selectedAccount =
    activeTradingAccounts.find((a) => a.id === selectedTradingAccountId) ??
    activeTradingAccounts[0];

  // Đang chọn TK không active → chuyển về TK active đầu tiên (nếu có)
  useEffect(() => {
    const active = tradingAccounts.filter((a) => a.status === 'ACTIVE');
    if (active.length === 0) return;
    const current = tradingAccounts.find((a) => a.id === selectedTradingAccountId);
    if (!current || current.status !== 'ACTIVE') {
      dispatch(setSelectedTradingAccountId(active[0].id));
    }
  }, [tradingAccounts, selectedTradingAccountId, dispatch]);

  useEffect(() => {
    if (!tradingMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!tradingMenuRef.current?.contains(e.target as Node)) {
        setTradingMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [tradingMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!userMenuRef.current?.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [userMenuOpen]);

  async function handleLogout() {
    try {
      await bffClient.post(GATEWAY_AUTH.logout);
    } catch {
      // Cookie có thể đã hết; vẫn xóa state phía client
    }
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, null);
    dispatch(clearUser());
    setTradingMenuOpen(false);
    setUserMenuOpen(false);
    router.refresh();
  }

  function isNavActive(route: '/priceboard' | '/account' | '/order'): boolean {
    const normalized = pathname.startsWith('/trade') ? pathname.slice('/trade'.length) || '/' : pathname;
    if (route === '/priceboard') {
      return normalized === '/' || normalized.startsWith('/priceboard');
    }
    return normalized.startsWith(route);
  }

  function navLinkClass(route: '/priceboard' | '/account' | '/order'): string {
    const active = isNavActive(route);
    return `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all duration-200 ${active
      ? 'bg-primary text-black shadow-[0_6px_18px_rgba(33,206,60,0.35)]'
      : 'border border-transparent text-muted hover:bg-white/[0.04] hover:text-foreground'
      }`;
  }

  return (
    <>
      <header
        className="h-12 flex items-center justify-between px-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center text-white text-xs font-bold">
              ST
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Stock Trading - Trading
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-xs">
            <Link href="/priceboard" className={navLinkClass('/priceboard')}>
              Bảng giá
            </Link>
            {!user ? (
              <button
                type="button"
                onClick={() => setAuthModal('login')}
                className={navLinkClass('/order')}
              >
                Đặt lệnh
              </button>
            ) : (
              <Link href="/order" className={navLinkClass('/order')}>
                Đặt lệnh
              </Link>
            )}
            {user ? (
              <Link href="/account" className={navLinkClass('/account')}>
                Tài khoản
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModal('login')}
                className={navLinkClass('/account')}
              >
                Tài khoản
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!user ? (
            <>
              <button
                onClick={() => setAuthModal('login')}
                className="text-sm font-medium px-3 py-1.5 rounded border"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Đăng nhập
              </button>
              <button
                onClick={() => setAuthModal('register')}
                className="text-sm font-medium px-3 py-1.5 rounded"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Mở tài khoản
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-[12px]">
              {activeTradingAccounts.length > 0 ? (
                <div className="relative" ref={tradingMenuRef}>
                  <button
                    type="button"
                    onClick={() => setTradingMenuOpen((o) => !o)}
                    className="flex items-center gap-1 rounded border px-2 py-1 font-mono text-[12px]"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    aria-expanded={tradingMenuOpen}
                    aria-haspopup="listbox"
                  >
                    {selectedAccount?.accountId ?? user.custId}
                    <ChevronDown size={14} className={tradingMenuOpen ? 'rotate-180' : ''} />
                  </button>
                  {tradingMenuOpen && (
                    <ul
                      className="absolute right-0 z-50 mt-1 min-w-[12rem] rounded border py-1 shadow-lg"
                      style={{
                        borderColor: 'var(--border)',
                        background: 'var(--surface)',
                      }}
                      role="listbox"
                    >
                      {activeTradingAccounts.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={a.id === selectedTradingAccountId}
                            className="flex w-full cursor-pointer items-center gap-[10px] px-3 py-2 text-left font-mono text-[12px] hover:bg-surface-2"
                            style={{ color: 'var(--foreground)' }}
                            onClick={() => {
                              dispatch(setSelectedTradingAccountId(a.id));
                              setTradingMenuOpen(false);
                            }}
                          >
                            <span className="block font-mono">{a.accountId}</span>
                            <span className="block text-muted">
                              {a.type} · {a.channel}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <span className="font-mono text-[12px] text-muted">{user.custId}</span>
              )}

              <NotificationBell />

              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex h-8 w-8 items-center justify-center rounded border text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Cài đặt tài khoản"
                >
                  <UserRoundCog size={18} strokeWidth={1.75} />
                </button>
                {userMenuOpen && (
                  <div
                    className="absolute right-0 z-50 mt-1 w-[17rem] rounded border py-2 text-[12px] shadow-lg"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--surface)',
                    }}
                    role="menu"
                  >
                    <div className="border-b border-border px-2 pb-2">
                      <p className="truncate font-medium text-foreground text-[14px]">
                        {user.fullName}
                      </p>
                      <p className="truncate font-mono text-muted">
                        {user.custId}
                      </p>
                    </div>

                    <Link
                      href="/settings/personal-info"
                      role="menuitem"
                      className="block border-b border-border px-2 py-2 text-foreground hover:bg-surface-2"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Thông tin cá nhân
                    </Link>

                    <SettingsTripleRow
                      className="border-b border-border"
                      title="Ngôn ngữ"
                      name="locale"
                      options={[
                        {
                          value: 'vi',
                          label: 'Tiếng Việt',
                          checked: localePref === 'vi',
                          onSelect: () => setLocalePref('vi'),
                        },
                        {
                          value: 'en',
                          label: 'Tiếng Anh',
                          checked: localePref === 'en',
                          onSelect: () => setLocalePref('en'),
                        },
                      ]}
                    />

                    <SettingsTripleRow
                      title="Giao diện"
                      name="theme"
                      options={[
                        {
                          value: 'dark',
                          label: 'Tối',
                          checked: themePref === 'dark',
                          onSelect: () => setThemePref('dark'),
                        },
                        {
                          value: 'light',
                          label: 'Sáng',
                          checked: themePref === 'light',
                          onSelect: () => setThemePref('light'),
                        },
                      ]}
                    />

                    <button
                      type="button"
                      role="menuitem"
                      className="w-full border-t border-border px-2 py-2 text-left font-medium text-red-500 hover:bg-red-500/10"
                      onClick={() => void handleLogout()}
                    >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {authModal && <AuthPopup mode={authModal} onClose={() => setAuthModal(null)} />}
    </>
  );
}
