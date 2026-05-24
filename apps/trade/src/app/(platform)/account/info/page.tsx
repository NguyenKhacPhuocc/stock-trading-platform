'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { bffClient } from '@stock/utils';
import { GATEWAY_USERS } from '@/lib/gateway-paths';
import { formatDateOnly } from '@/lib/format-date';
import { useAppDispatch } from '@/store/hooks';
import { patchUserProfile } from '@/store/slices/auth.slice';
import { useRequireAuth } from '@/hooks/use-require-auth';

type KycStatus = 'pending' | 'simulated_verified' | 'rejected';

type ProfileDto = {
  id: string;
  custId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  identity: {
    nationalIdNumber: string | null;
    dateOfBirth: string | null;
    address: string | null;
    kycStatus: KycStatus;
    kycStatusLabel: string;
  };
  editable: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
  verification: {
    phoneOtpRequired: boolean;
    emailOtpRequired: boolean;
  };
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const panel =
  'rounded-lg border border-border bg-[#0b0d11] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
const inputEditable =
  'w-full rounded border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none transition-shadow focus:border-primary/60 focus:shadow-[0_0_0_2px_rgba(33,206,60,0.15)]';

function kycBadgeClass(status: KycStatus): string {
  if (status === 'simulated_verified') {
    return 'border-primary/40 bg-primary/10 text-primary';
  }
  if (status === 'rejected') {
    return 'border-price-down/40 bg-price-down/10 text-price-down';
  }
  return 'border-border bg-surface-2 text-muted';
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border/40 py-3 last:border-b-0 sm:grid-cols-[minmax(7.5rem,10rem)_1fr] sm:items-start sm:gap-4">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd
        className={`text-[12px] text-foreground ${mono ? 'font-mono' : ''} ${value ? '' : 'text-muted/60'}`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 max-w-prose text-[11px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default function AccountInfoPage() {
  const dispatch = useAppDispatch();
  const { authUser, handleSessionExpired } = useRequireAuth();

  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const res = await bffClient.get(GATEWAY_USERS.profile);
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const json = res.data;
      if (json?.s !== 'ok' || !json.d) {
        throw new Error(json?.em || 'Không tải được hồ sơ');
      }
      const p = json.d as ProfileDto;
      setProfile(p);
      setFullName(p.fullName ?? '');
      setPhone(p.phone ?? '');
      setEmail(p.email ?? '');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không tải được hồ sơ';
      toast.error(message);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    const payload: { fullName?: string; phone?: string; email?: string } = {};
    const phoneTrim = phone.trim();
    const emailTrim = email.trim();

    if (profile.editable.fullName) {
      const name = fullName.trim();
      if (name.length < 2) {
        toast.error('Họ tên tối thiểu 2 ký tự');
        return;
      }
      if (name !== profile.fullName) payload.fullName = name;
    }

    if (phoneTrim && !/^[0-9]{10,11}$/.test(phoneTrim)) {
      toast.error('Số điện thoại không hợp lệ (10–11 số)');
      return;
    }
    const nextPhone = phoneTrim || null;
    if (nextPhone !== profile.phone) {
      payload.phone = phoneTrim || undefined;
    }

    if (profile.editable.email) {
      const currentEmail = profile.email?.trim() || '';
      if (emailTrim !== currentEmail) {
        if (emailTrim && !emailPattern.test(emailTrim)) {
          toast.error('Email không hợp lệ');
          return;
        }
        payload.email = emailTrim;
      }
    }

    if (Object.keys(payload).length === 0) {
      toast.info('Không có thay đổi để lưu');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await bffClient.patch(GATEWAY_USERS.profile, payload);
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const json = res.data;
      if (json?.s !== 'ok') {
        throw new Error(json?.em || 'Không cập nhật được hồ sơ');
      }
      const p = json.d as ProfileDto;
      setProfile(p);
      setFullName(p.fullName ?? '');
      setPhone(p.phone ?? '');
      setEmail(p.email ?? '');
      dispatch(
        patchUserProfile({
          fullName: p.fullName,
          email: p.email,
        }),
      );
      toast.success('Đã cập nhật thông tin liên hệ');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không cập nhật được hồ sơ';
      toast.error(message);
    } finally {
      setIsSavingProfile(false);
    }
  }

  const custId = profile?.custId || authUser?.custId || '—';
  const identity = profile?.identity;
  const canEditName = profile?.editable.fullName ?? false;
  const busy = isLoadingProfile || isSavingProfile;

  return (
    <div
      className={`flex min-h-full w-full flex-col gap-4 p-4 sm:p-5 lg:p-6 ${isLoadingProfile ? 'pointer-events-none opacity-70' : ''}`}
    >
      {/* Header — full width */}
      <header className={`${panel} flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5`}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-primary">
          <UserRound size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-semibold text-foreground">Thông tin cá nhân</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            Mã khách hàng{' '}
            <span className="font-mono text-foreground">{custId}</span>
          </p>
        </div>
        {identity ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${kycBadgeClass(identity.kycStatus)}`}
          >
            <ShieldCheck size={13} />
            {identity.kycStatusLabel}
          </span>
        ) : null}
      </header>

      {/* Body — 2 cột trên màn rộng */}
      <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-start">
        {/* Định danh */}
        <section className={panel}>
          <SectionHead
            title="Thông tin định danh"
            description="Dữ liệu trên giấy tờ / hồ sơ mở tài khoản. Sau KYC không chỉnh sửa trực tuyến."
          />
          <dl className="px-4 sm:px-5">
            {canEditName ? (
              <div className="border-b border-border/40 py-3">
                <label className="block text-[11px] font-medium uppercase tracking-wide text-muted">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={busy}
                  className={`${inputEditable} mt-2`}
                  autoComplete="name"
                />
                <p className="mt-1.5 text-[11px] text-muted/80">
                  Chưa xác thực KYC — có thể cập nhật tạm trước khi khóa hồ sơ.
                </p>
              </div>
            ) : (
              <InfoRow label="Họ và tên" value={fullName} />
            )}
            <InfoRow
              label="Số CCCD/CMND"
              value={identity?.nationalIdNumber ?? ''}
              mono
            />
            <InfoRow
              label="Ngày sinh"
              value={
                identity?.dateOfBirth?.trim()
                  ? formatDateOnly(identity.dateOfBirth)
                  : ''
              }
            />
            <InfoRow label="Địa chỉ thường trú" value={identity?.address?.trim() ?? ''} />
          </dl>
        </section>

        {/* Liên hệ */}
        <section className={`${panel} flex flex-col xl:sticky xl:top-4`}>
          <SectionHead
            title="Thông tin liên hệ"
            description="SĐT và email nhận thông báo. OTP sẽ chèn trước bước lưu (hiện lưu trực tiếp)."
          />
          <form
            className="flex flex-1 flex-col px-4 pb-4 sm:px-5"
            onSubmit={(e) => void handleSaveProfile(e)}
          >
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block text-[12px] text-muted">
                Số điện thoại
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy}
                  placeholder="10–11 chữ số"
                  className={`${inputEditable} mt-1.5`}
                  autoComplete="tel"
                />
              </label>
              <label className="block text-[12px] text-muted">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy || !profile?.editable.email}
                  placeholder="example@gmail.com"
                  className={`${inputEditable} mt-1.5`}
                  autoComplete="email"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-4">
              <button
                type="submit"
                disabled={busy || !profile}
                className="rounded-md bg-primary px-5 py-2 text-[12px] font-medium text-black transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {isSavingProfile ? 'Đang lưu...' : 'Lưu thông tin liên hệ'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
