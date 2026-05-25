'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { GATEWAY_USERS } from '@/lib/gateway-paths';
import { useRequireAuth } from '@/hooks/use-require-auth';

const panelCard = 'rounded-md border border-border bg-[#0b0d11]';
const inputClass =
  'w-full rounded border border-border bg-background px-3 py-2 text-[12px] tracking-[0.35em] text-foreground outline-none transition-shadow focus:border-primary/60 focus:shadow-[0_0_0_2px_rgba(33,206,60,0.15)] [-webkit-text-security:disc]';

function PinField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-[12px] text-muted">
      {label}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        disabled={disabled}
        className={`${inputClass} mt-1`}
        placeholder="••••••"
      />
    </label>
  );
}

export default function ChangePinPage() {
  const { handleSessionExpired } = useRequireAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (currentPin.length !== 6 || pin.length !== 6 || confirmPin.length !== 6) {
      toast.error('Vui lòng nhập đủ 6 chữ số cho mỗi ô PIN');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(GATEWAY_USERS.changeTradingPin, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, pin, confirmPin }),
      });
      const json = await res.json();
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không đổi được mã PIN');
      }
      setCurrentPin('');
      setPin('');
      setConfirmPin('');
      toast.success('Đã đổi mã PIN giao dịch');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không đổi được mã PIN');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <header>
          <h1 className="text-[12px] font-semibold text-foreground">Đổi mã PIN</h1>
          <p className="mt-1 text-[12px] text-muted">
            Mã PIN giao dịch 6 chữ số dùng khi xác nhận đặt lệnh.
          </p>
        </header>
        <section className={`${panelCard} p-4`}>
          <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
            <PinField label="PIN cũ" value={currentPin} onChange={setCurrentPin} disabled={busy} />
            <PinField label="PIN mới" value={pin} onChange={setPin} disabled={busy} />
            <PinField
              label="Nhập lại PIN mới"
              value={confirmPin}
              onChange={setConfirmPin}
              disabled={busy}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setCurrentPin('');
                  setPin('');
                  setConfirmPin('');
                }}
                className="rounded border border-border px-4 py-2 text-[12px] text-foreground hover:bg-surface-2 disabled:opacity-50"
              >
                Làm mới
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-primary px-4 py-2 text-[12px] font-medium text-black hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Đang lưu...' : 'Tiếp tục'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
