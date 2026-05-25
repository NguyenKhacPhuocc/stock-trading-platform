'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getConfirmOrderNextTime,
  getTradeLocale,
  getTradeTheme,
  setConfirmOrderNextTime,
  setTradeLocale,
  setTradeTheme,
  type TradeLocale,
  type TradeTheme,
} from '@/lib/trade-user-prefs';
import { useRequireAuth } from '@/hooks/use-require-auth';

const panelCard = 'rounded-md border border-border bg-[#0b0d11] p-4';

export default function GeneralConfigPage() {
  useRequireAuth();
  const [locale, setLocale] = useState<TradeLocale>('vi');
  const [theme, setTheme] = useState<TradeTheme>('dark');
  const [confirmOrder, setConfirmOrder] = useState(true);

  useEffect(() => {
    setLocale(getTradeLocale());
    setTheme(getTradeTheme());
    setConfirmOrder(getConfirmOrderNextTime());
  }, []);

  function handleSave() {
    setTradeLocale(locale);
    setTradeTheme(theme);
    setConfirmOrderNextTime(confirmOrder);
    toast.success('Đã lưu cấu hình');
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <header>
          <h1 className="text-[12px] font-semibold text-foreground">Cấu hình chung</h1>
        </header>
        <section className={`${panelCard} space-y-4`}>
          <label className="block text-[12px] text-muted">
            Ngôn ngữ
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as TradeLocale)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-[12px] text-foreground"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 text-[12px] text-foreground">
            <span>Hiển thị xác nhận lệnh cho lần sau</span>
            <input
              type="checkbox"
              checked={confirmOrder}
              onChange={(e) => setConfirmOrder(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
          </label>

          <fieldset className="space-y-2 text-[12px]">
            <legend className="text-muted">Giao diện</legend>
            <label className="flex items-center gap-2 text-foreground">
              <input
                type="radio"
                name="theme"
                checked={theme === 'light'}
                onChange={() => setTheme('light')}
                className="accent-[var(--primary)]"
              />
              Giao diện sáng
            </label>
            <label className="flex items-center gap-2 text-foreground">
              <input
                type="radio"
                name="theme"
                checked={theme === 'dark'}
                onChange={() => setTheme('dark')}
                className="accent-[var(--primary)]"
              />
              Giao diện tối
            </label>
          </fieldset>

          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-primary px-4 py-2 text-[12px] font-medium text-black hover:opacity-90"
          >
            Lưu thay đổi
          </button>
        </section>
      </div>
    </div>
  );
}
