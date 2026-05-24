'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GATEWAY_USERS } from '@/lib/gateway-paths';
import {
  AUTH_SESSION_QUERY_KEY,
  fetchAuthenticatedSession,
} from '@/lib/fetch-auth-session';
import { useAppDispatch } from '@/store/hooks';
import { setHasTradingPin, setSession } from '@/store/slices/auth.slice';

type TradingPinSetupModalProps = {
  open: boolean;
};

export function TradingPinSetupModal({ open }: TradingPinSetupModalProps) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const canSubmit =
    pin.length === 6 && confirmPin.length === 6 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(GATEWAY_USERS.setupTradingPin, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, confirmPin }),
      });
      const json = await res.json();
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không tạo được mã PIN');
      }
      dispatch(setHasTradingPin());
      const session = await fetchAuthenticatedSession();
      if (session) {
        queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, session);
        dispatch(setSession(session));
      }
      setPin('');
      setConfirmPin('');
      toast.success('Đã tạo mã PIN giao dịch');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không tạo được mã PIN';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trading-pin-setup-title"
    >
      <div className="w-full max-w-md rounded-md border border-border bg-[#0b0d11] p-5 text-xs shadow-lg">
        <h2
          id="trading-pin-setup-title"
          className="mb-2 text-sm font-semibold text-foreground"
        >
          Thiết lập mã PIN giao dịch
        </h2>
        <p className="mb-4 text-[11px] leading-relaxed text-muted">
          Mỗi tài khoản cần mã PIN 6 số để xác thực khi đặt lệnh và các thao tác
          quan trọng. Vui lòng tạo PIN trước khi tiếp tục sử dụng hệ thống.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted">Mã PIN (6 số)</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              name="trading-pin-new"
              data-lpignore="true"
              data-1p-ignore
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded border border-border bg-[#11141b] px-2 py-2 text-sm tracking-[0.35em] outline-none [-webkit-text-security:disc]"
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted">Nhập lại PIN</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              name="trading-pin-confirm-new"
              data-lpignore="true"
              data-1p-ignore
              maxLength={6}
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              className="w-full rounded border border-border bg-[#11141b] px-2 py-2 text-sm tracking-[0.35em] outline-none [-webkit-text-security:disc]"
              placeholder="••••••"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="mt-5 w-full rounded bg-primary py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Đang lưu...' : 'Tạo mã PIN'}
        </button>
      </div>
    </div>
  );
}
