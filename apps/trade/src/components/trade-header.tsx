'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { clearUser, setSelectedTradingAccountId } from '@/store/slices/auth.slice';
import { bffClient } from '@stock/utils';
import { GATEWAY_AUTH } from '@/lib/gateway-paths';
import AuthPopup from './auth-popup';

export default function TradeHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

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
    if (!accountMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!accountMenuRef.current?.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [accountMenuOpen]);

  async function handleLogout() {
    try {
      await bffClient.post(GATEWAY_AUTH.logout);
    } catch {
      // Cookie có thể đã hết; vẫn xóa state phía client
    }
    dispatch(clearUser());
    setAccountMenuOpen(false);
    router.refresh();
  }

  function isNavActive(route: '/priceboard' | '/portfolio' | '/order'): boolean {
    const normalized = pathname.startsWith('/trade') ? pathname.slice('/trade'.length) || '/' : pathname;
    if (route === '/priceboard') {
      return normalized === '/' || normalized.startsWith('/priceboard');
    }
    return normalized.startsWith(route);
  }

  function navLinkClass(route: '/priceboard' | '/portfolio' | '/order'): string {
    const active = isNavActive(route);
    return `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all duration-200 ${
      active
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
            <Link href="/portfolio" className={navLinkClass('/portfolio')}>
              Danh mục
            </Link>
            <Link href="/order" className={navLinkClass('/order')}>
              Đặt lệnh
            </Link>
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
            <div className="flex items-center gap-3 text-sm">
              {activeTradingAccounts.length > 0 ? (
                <div className="relative" ref={accountMenuRef}>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((o) => !o)}
                    className="flex items-center gap-1 rounded border px-2 py-1 text-xs font-mono"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    aria-expanded={accountMenuOpen}
                    aria-haspopup="listbox"
                  >
                    {selectedAccount?.accountId ?? user.custId}
                    <ChevronDown size={14} className={accountMenuOpen ? 'rotate-180' : ''} />
                  </button>
                  {accountMenuOpen && (
                    <ul
                      className="absolute right-0 z-50 mt-1 min-w-[12rem] rounded border py-1"
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
                            className="w-full px-3 py-2 text-left text-xs font-mono hover:bg-surface-2 cursor-pointer flex gap-[10px] items-center"
                            style={{ color: 'var(--foreground)' }}
                            onClick={() => {
                              dispatch(setSelectedTradingAccountId(a.id));
                              setAccountMenuOpen(false);
                            }}
                          >
                            <span className="block font-mono">{a.accountId}</span>
                            <span className="block text-[10px] text-white">
                              {a.type} · {a.channel}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <span className="text-xs font-mono text-muted">{user.custId}</span>
              )}

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="text-xs px-2 py-1 rounded border border-border text-white font-bold cursor-pointer bg-red-600 hover:bg-red-400"
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </header>

      {authModal && <AuthPopup mode={authModal} onClose={() => setAuthModal(null)} />}
    </>
  );
}
