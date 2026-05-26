'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getNotifyPrefs,
  setNotifyPrefs,
  type TradeNotifyPrefs,
} from '@/lib/trade-user-prefs';
import { useRequireAuth } from '@/hooks/use-require-auth';

const panelCard = 'rounded-md border border-border bg-[#0b0d11] p-4';

const OPTIONS: { key: keyof TradeNotifyPrefs; label: string }[] = [
  { key: 'orderMatched', label: 'Thông báo khớp lệnh' },
  { key: 'orderPlaced', label: 'Thông báo xác nhận lệnh' },
  { key: 'cashBalance', label: 'Thông báo biến động số dư tiền' },
];

export default function NotifyAccountPage() {
  useRequireAuth();
  const [prefs, setPrefs] = useState<TradeNotifyPrefs>(getNotifyPrefs());

  useEffect(() => {
    setPrefs(getNotifyPrefs());
  }, []);

  function toggle(key: keyof TradeNotifyPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  function handleSave() {
    setNotifyPrefs(prefs);
    toast.success('Đã lưu thiết lập thông báo');
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <header>
          <h1 className="text-sm font-semibold text-foreground">
            Thiết lập thông báo tài khoản
          </h1>
        </header>
        <section className={`${panelCard} space-y-3`}>
          {OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
            >
              <input
                type="checkbox"
                checked={prefs[opt.key]}
                onChange={() => toggle(opt.key)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              {opt.label}
            </label>
          ))}
          <button
            type="button"
            onClick={handleSave}
            className="mt-2 rounded bg-primary px-4 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            Lưu thay đổi
          </button>
        </section>
      </div>
    </div>
  );
}
