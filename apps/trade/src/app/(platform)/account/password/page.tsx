'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { bffClient } from '@stock/utils';
import { GATEWAY_USERS } from '@/lib/gateway-paths';
import { useRequireAuth } from '@/hooks/use-require-auth';

const panelCard = 'rounded-md border border-border bg-[#0b0d11]';
const inputClass =
  'w-full rounded border border-border bg-background px-3 py-2 pr-10 text-[12px] text-foreground outline-none transition-shadow focus:border-primary/60 focus:shadow-[0_0_0_2px_rgba(33,206,60,0.15)]';

function PasswordField({
  label,
  value,
  onChange,
  disabled,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <label className="block text-[12px] text-muted">
      {label}
      <div className="relative mt-1">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputClass}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted disabled:cursor-not-allowed"
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  );
}

export default function AccountPasswordPage() {
  const { handleSessionExpired } = useRequireAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error('Vui lòng nhập đủ mật khẩu');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới tối thiểu 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await bffClient.patch(GATEWAY_USERS.changePassword, {
        currentPassword,
        newPassword,
      });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const json = res.data;
      if (json?.s !== 'ok') {
        throw new Error(json?.em || 'Không đổi được mật khẩu');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Đổi mật khẩu thành công');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không đổi được mật khẩu';
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <header>
          <h1 className="text-[12px] font-semibold text-foreground">Đổi mật khẩu</h1>
          <p className="mt-1 text-[12px] text-muted">Mật khẩu mới tối thiểu 6 ký tự.</p>
        </header>

        <section className={`${panelCard} p-4`}>
          <form className="space-y-3" onSubmit={(e) => void handleChangePassword(e)}>
            <PasswordField
              label="Mật khẩu hiện tại"
              value={currentPassword}
              onChange={setCurrentPassword}
              disabled={isChangingPassword}
              autoComplete="current-password"
            />
            <PasswordField
              label="Mật khẩu mới"
              value={newPassword}
              onChange={setNewPassword}
              disabled={isChangingPassword}
              autoComplete="new-password"
            />
            <PasswordField
              label="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={isChangingPassword}
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={isChangingPassword}
              className="rounded bg-primary px-4 py-2 text-[12px] font-medium text-black transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {isChangingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
