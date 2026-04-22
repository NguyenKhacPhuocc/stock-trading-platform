'use client';

import { X, Eye, EyeOff, QrCode, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Tooltip } from '@/components/tooltip';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { setSession } from '@/store/slices/auth.slice';
import { fetchAuthenticatedSession } from '@/lib/fetch-auth-session';
import { apiClient } from '@stock/utils';
import { APP_CONFIG } from '@/config/app.config';

// ─── AuthPopup ───────────────────────────────────────────────────────────────

interface AuthPopupProps {
  mode: 'login' | 'register';
  onClose: () => void;
  onSwitchMode?: (mode: 'login' | 'register') => void;
}

interface RegisterDone {
  custId: string;
  defaultAccountId: string;
  hadEmail: boolean;
}

const emptyRegister = {
  fullName: '',
  password: '',
  email: '',
  phone: '',
  nationalIdNumber: '',
  dateOfBirth: '',
  address: '',
};

export default function AuthPopup({ mode, onClose, onSwitchMode }: AuthPopupProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [currentMode, setCurrentMode] = useState<'login' | 'register'>(mode);
  const [loginForm, setLoginForm] = useState<{ custId: string; password: string }>({
    custId: APP_CONFIG.brokerCode,
    password: '',
  });
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerDone, setRegisterDone] = useState<RegisterDone | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  function switchMode(m: 'login' | 'register') {
    setCurrentMode(m);
    setError('');
    onSwitchMode?.(m);
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleClose() {
    setRegisterDone(null);
    setCopied(false);
    setRegisterForm(emptyRegister);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (currentMode === 'login') {
        await apiClient.post('/auth/login', loginForm);
        const session = await fetchAuthenticatedSession();
        if (session) dispatch(setSession(session));
        else throw new Error('Không tải được session sau đăng nhập');
        onClose();
        router.refresh();
      } else {
        const hadEmail = Boolean(registerForm.email?.trim());
        const payload = {
          fullName: registerForm.fullName,
          password: registerForm.password,
          email: registerForm.email || undefined,
          phone: registerForm.phone || undefined,
          nationalIdNumber: registerForm.nationalIdNumber || undefined,
          dateOfBirth: registerForm.dateOfBirth || undefined,
          address: registerForm.address || undefined,
        };
        const res = await apiClient.post('/auth/register', payload);
        const result = res.data?.d as {
          custId?: string;
          defaultAccountId?: string;
        } | null;
        if (!result?.custId || !result?.defaultAccountId) {
          throw new Error('Thiếu custId / defaultAccountId trong phản hồi');
        }
        setRegisterForm(emptyRegister);
        setRegisterDone({
          custId: result.custId,
          defaultAccountId: result.defaultAccountId,
          hadEmail,
        });
      }
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { em?: string; message?: string } } })?.response
        ?.data;
      const msg = errData?.em ?? errData?.message;
      setError(msg || (currentMode === 'login' ? 'Đăng nhập thất bại' : 'Đăng ký thất bại'));
    } finally {
      setLoading(false);
    }
  }

  const reg = registerForm;
  const setReg = (patch: Partial<typeof emptyRegister>) => setRegisterForm((f) => ({ ...f, ...patch }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-4"
      onClick={registerDone ? handleClose : onClose}
    >
      {/* Không overflow-y-auto ở lớp nền — tránh 2 thanh scroll (nền + cột form). Chiều cao card bị cap theo viewport. */}
      <div
        className="flex h-[min(92vh,calc(100dvh-2rem))] max-h-[min(92vh,calc(100dvh-2rem))] w-[76vw] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hàng riêng: nút đóng góc phải */}
        <div className="flex shrink-0 justify-end px-5 pt-5 pb-2">
          <button
            type="button"
            onClick={registerDone ? handleClose : onClose}
            className="rounded p-1.5 text-muted transition-colors bg-[#252836] hover:bg-surface-2 hover:text-foreground hover:cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-[65%_minmax(0,1fr)] md:items-stretch">
          {/* Cột trái — fill chiều cao hàng còn lại của card */}
          <div className="relative hidden min-h-[200px] w-full overflow-hidden rounded-xl bg-black md:block md:h-full md:min-h-0">
            <ImageSlider />
          </div>

          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="mb-4 flex items-center gap-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`cursor-pointer border-b-2 px-1 pb-1 text-sm font-semibold transition-colors ${currentMode === 'login' ? 'border-primary text-primary' : 'border-transparent text-muted'}`}
              >
                Đăng nhập
              </button>
              <span className="mx-1 text-muted">|</span>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`cursor-pointer border-b-2 px-1 pb-1 text-sm font-semibold transition-colors ${currentMode === 'register' ? 'border-primary text-primary' : 'border-transparent text-muted'}`}
              >
                Mở tài khoản
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {registerDone ? (
                <div className="space-y-4 py-2">
                  <p className="text-sm font-medium text-center text-foreground">
                    Đăng ký thành công
                  </p>

                  <div className="rounded-lg px-4 py-4 text-center border border-border bg-surface-2">
                    <p className="text-xs mb-2 text-muted">
                      CustId (mã khách — dùng đăng nhập)
                    </p>
                    <p className="text-2xl font-bold tracking-widest select-all text-foreground font-mono">
                      {registerDone.custId}
                    </p>
                    <p className="text-xs mt-3 text-muted">Tiểu khoản cash mặc định (.1)</p>
                    <p className="text-sm font-mono font-semibold text-foreground select-all">
                      {registerDone.defaultAccountId}
                    </p>
                  </div>

                  <p className="text-xs text-center text-muted">
                    Lưu custId để đăng nhập; giao dịch gắn với số tiểu khoản (.1, .5…).
                  </p>

                  <button
                    type="button"
                    onClick={() => handleCopy(`${registerDone.custId}\n${registerDone.defaultAccountId}`)}
                    className="w-full py-2 rounded text-sm font-medium border border-border text-foreground bg-transparent transition-opacity"
                  >
                    {copied ? 'Đã copy ✓' : 'Sao chép custId + TK .1'}
                  </button>

                  {registerDone.hadEmail ? (
                    <p className="text-xs text-center text-muted">
                      Ở hệ thống thật, mã thường được gửi qua email đã đăng ký.{' '}
                      <span className="opacity-60">(Bản mô phỏng: không gửi email.)</span>
                    </p>
                  ) : (
                    <p className="text-xs text-center text-muted opacity-70">
                      Bản mô phỏng: không gửi email.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-2 rounded text-sm font-medium bg-primary text-white"
                  >
                    Đóng
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  {currentMode === 'login' ? (
                    <>
                      <Field label="CustId (mã khách)">
                        <input
                          type="text"
                          required
                          placeholder="025C000001"
                          value={loginForm.custId}
                          onChange={(e) => setLoginForm({ ...loginForm, custId: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                        />
                      </Field>
                      <Field label="Mật khẩu">
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            placeholder="Vui lòng nhập"
                            value={loginForm.password}
                            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                            className="w-full px-3 py-2 pr-10 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted cursor-pointer"
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </Field>

                      <div className="flex justify-end">
                        <button type="button" className="text-xs text-primary hover:underline cursor-pointer">
                          Quên mật khẩu?
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Field label="Họ và tên" required>
                        <input
                          type="text"
                          required
                          placeholder="Nguyễn Văn A"
                          value={reg.fullName}
                          onChange={(e) => setReg({ fullName: e.target.value })}
                          className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                        />
                      </Field>

                      <Field label="Mật khẩu" required>
                        <div className="relative">
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            required
                            value={reg.password}
                            onChange={(e) => setReg({ password: e.target.value })}
                            className="w-full px-3 py-2 pr-10 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted cursor-pointer"
                          >
                            {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </Field>

                      <Field
                        label="Email"
                        tooltip={<Tooltip text="Dùng để nhận custId & thông báo giao dịch. Không bắt buộc nhưng khuyến khích điền." />}
                      >
                        <input
                          type="email"
                          placeholder="example@gmail.com"
                          value={reg.email}
                          onChange={(e) => setReg({ email: e.target.value })}
                          className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                        />
                      </Field>

                      <Field
                        label="Số điện thoại"
                        tooltip={<Tooltip text="Dùng để xác minh danh tính và liên hệ khi cần. Không bắt buộc." />}
                      >
                        <input
                          type="tel"
                          placeholder="0900000000"
                          value={reg.phone}
                          onChange={(e) => setReg({ phone: e.target.value })}
                          className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                        />
                      </Field>

                      <Field
                        label="Số CCCD / CMND"
                        tooltip={<Tooltip text="Nhập bất kỳ để kích hoạt KYC giả lập. Không bắt buộc trong bản mô phỏng." />}
                      >
                        <input
                          type="text"
                          placeholder="001234567890"
                          value={reg.nationalIdNumber}
                          onChange={(e) => setReg({ nationalIdNumber: e.target.value })}
                          className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                        />
                      </Field>

                      <Field label="Ngày sinh">
                        <input
                          type="date"
                          value={reg.dateOfBirth}
                          onChange={(e) => setReg({ dateOfBirth: e.target.value })}
                          className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                        />
                      </Field>

                      <Field
                        label="Địa chỉ"
                        tooltip={<Tooltip text="Địa chỉ thường trú hoặc liên hệ. Không bắt buộc." side="top" align="center" />}
                      >
                        <input
                          type="text"
                          placeholder="123 Đường ABC, Quận 1, TP.HCM"
                          value={reg.address}
                          onChange={(e) => setReg({ address: e.target.value })}
                          className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                        />
                      </Field>
                    </>
                  )}

                  {error && (
                    <p className="text-xs text-center text-price-down">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded font-medium text-sm transition-opacity disabled:opacity-60 bg-primary text-white"
                  >
                    {loading ? 'Đang xử lý...' : currentMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                  </button>

                  {currentMode === 'login' && (
                    <>
                      <div className="flex items-center gap-2 my-1">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted">hoặc đăng nhập nhanh bằng QR code</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="flex justify-center">
                        <button
                          type="button"
                          className="p-2.5 rounded border border-border bg-surface-2 text-primary cursor-pointer hover:bg-surface transition-colors"
                        >
                          <QrCode size={22} />
                        </button>
                      </div>
                      <p className="text-xs text-center text-muted">
                        Quý khách chưa có tài khoản?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('register')}
                          className="text-primary hover:underline cursor-pointer font-medium"
                        >
                          Mở tài khoản
                        </button>
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-border">
                        <button type="button" className="flex items-center gap-1 text-xs text-muted hover:text-foreground cursor-pointer transition-colors">
                          Điều khoản và Liên hệ <ChevronDown size={12} />
                        </button>
                        <button type="button" className="flex items-center gap-1 text-xs text-muted hover:text-foreground cursor-pointer transition-colors">
                          Tiếng Việt <ChevronDown size={12} />
                        </button>
                      </div>
                    </>
                  )}

                  {currentMode === 'register' && (
                    <p className="text-xs text-center text-muted">
                      Đã có tài khoản?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="text-primary hover:underline cursor-pointer font-medium"
                      >
                        Đăng nhập
                      </button>
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ImageSlider ─────────────────────────────────────────────────────────────

const SLIDES = [
  {
    src: '/trade/image-1.png',
    caption: 'Giao dịch chứng khoán mọi lúc, mọi nơi',
    sub: 'Nền tảng mô phỏng thị trường VN real-time',
  },
  {
    src: '/trade/image-2.png',
    caption: 'Phân tích thị trường thông minh',
    sub: 'AI hỗ trợ dự báo xu hướng & cảnh báo biến động',
  },
];

function ImageSlider() {
  const [idx, setIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  function goTo(to: number) {
    if (transitioning || to === idx) return;
    setTransitioning(true);
    setIdx(to);
    setTimeout(() => setTransitioning(false), 500);
  }

  useEffect(() => {
    const t = setInterval(() => {
      goTo((idx + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, transitioning]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/*
        Dải ảnh: flex row gồm N ảnh, mỗi ảnh width=100%.
        Dịch container bằng translateX(-idx * 100%) để lướt mượt.
      */}
      <div
        className="flex h-full"
        style={{
          width: `${SLIDES.length * 100}%`,
          transform: `translateX(-${(idx * 100) / SLIDES.length}%)`,
          transition: transitioning ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          willChange: 'transform',
        }}
      >
        {SLIDES.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={s.src}
            alt={s.caption}
            style={{ width: `${100 / SLIDES.length}%` }}
            className="h-full object-cover object-center shrink-0"
          />
        ))}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent z-10" />

      {/* Caption + dots */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
        <p className="text-sm font-semibold text-white leading-snug">{SLIDES[idx].caption}</p>
        <p className="text-xs mt-0.5 text-white/60">{SLIDES[idx].sub}</p>
        <div className="flex gap-1.5 mt-3">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full cursor-pointer border-0 p-0 h-[5px] transition-all duration-300 ${i === idx ? 'w-[18px] bg-primary' : 'w-[5px] bg-white/40'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  tooltip,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  tooltip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs mb-1 text-muted">
        <span className='flex items-center justify-center gap-[4px]'>
          {label}
          {required && <span className="text-price-down"> *</span>}
        </span>
        {tooltip}
      </label>
      {children}
      {hint && (
        <p className="text-xs mt-0.5 text-muted">{hint}</p>
      )}
    </div>
  );
}
