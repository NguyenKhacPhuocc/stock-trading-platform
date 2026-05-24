'use client';

import { X, Eye, EyeOff, QrCode, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tooltip } from '@/components/tooltip';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { setSession } from '@/store/slices/auth.slice';
import {
  AUTH_SESSION_QUERY_KEY,
  fetchAuthenticatedSession,
} from '@/lib/fetch-auth-session';
import { queryClient } from '@stock/utils';
import { GATEWAY_AUTH } from '@/lib/gateway-paths';
import { bffClient } from '@stock/utils';
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

  const [currentMode, setCurrentMode] = useState<'login' | 'register' | 'forgot'>(mode);
  const [forgotStep, setForgotStep] = useState<'request' | 'confirm'>('request');
  const [loginForm, setLoginForm] = useState<{ custId: string; password: string }>({
    custId: APP_CONFIG.brokerCode,
    password: '',
  });
  const [forgotForm, setForgotForm] = useState({
    custId: APP_CONFIG.brokerCode,
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [loading, setLoading] = useState(false);
  const [registerDone, setRegisterDone] = useState<RegisterDone | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [qrHintOpen, setQrHintOpen] = useState(false);

  function switchMode(m: 'login' | 'register') {
    setCurrentMode(m);
    setForgotStep('request');
    setSimulatedOtp(null);
    setRegisterDone(null);
    setCopied(false);
    setQrHintOpen(false);
    onSwitchMode?.(m);
  }

  function openForgotPassword() {
    setForgotForm((f) => ({
      ...f,
      custId: loginForm.custId,
      otp: '',
      newPassword: '',
      confirmPassword: '',
    }));
    setForgotStep('request');
    setSimulatedOtp(null);
    setCurrentMode('forgot');
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

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await bffClient.post(GATEWAY_AUTH.forgotPasswordRequest, {
        custId: forgotForm.custId,
        email: forgotForm.email,
      });
      if (res.data?.s !== 'ok') {
        throw new Error(res.data?.em || 'Không gửi được yêu cầu');
      }
      const d = res.data.d as { message?: string; simulatedOtp?: string } | null;
      setSimulatedOtp(d?.simulatedOtp ?? null);
      setForgotStep('confirm');
      toast.success(d?.message || 'Đã tạo mã xác thực');
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { em?: string } } })?.response?.data;
      toast.error(errData?.em ?? (err as Error)?.message ?? 'Không gửi được yêu cầu');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (forgotForm.newPassword.length < 6) {
      toast.error('Mật khẩu mới tối thiểu 6 ký tự');
      return;
    }
    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    setLoading(true);
    try {
      const res = await bffClient.post(GATEWAY_AUTH.forgotPasswordConfirm, {
        custId: forgotForm.custId,
        email: forgotForm.email,
        otp: forgotForm.otp,
        newPassword: forgotForm.newPassword,
      });
      if (res.data?.s !== 'ok') {
        throw new Error(res.data?.em || 'Không đặt lại được mật khẩu');
      }
      toast.success(
        (res.data.d as { message?: string })?.message || 'Đặt lại mật khẩu thành công',
      );
      setLoginForm({ custId: forgotForm.custId.toUpperCase(), password: '' });
      switchMode('login');
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { em?: string } } })?.response?.data;
      toast.error(errData?.em ?? (err as Error)?.message ?? 'Không đặt lại được mật khẩu');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (currentMode === 'forgot') {
      if (forgotStep === 'request') await handleForgotRequest(e);
      else await handleForgotConfirm(e);
      return;
    }
    setLoading(true);
    try {
      if (currentMode === 'login') {
        const res = await bffClient.post(GATEWAY_AUTH.login, loginForm);
        if (!res.data?.d?.user) throw new Error('Không tải được thông tin người dùng sau đăng nhập');
        const session = await fetchAuthenticatedSession();
        if (session) {
          queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, session);
          dispatch(setSession(session));
        } else throw new Error('Không tải được session sau đăng nhập');
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
        const res = await bffClient.post(GATEWAY_AUTH.register, payload);
        const result = res.data?.d as { custId?: string; defaultAccountId?: string } | null;
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
      const msg = errData?.em ?? errData?.message ?? (err as Error)?.message;
      toast.error(
        msg || (currentMode === 'login' ? 'Đăng nhập thất bại' : 'Đăng ký thất bại'),
      );
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
        className="flex h-[min(92vh,calc(100dvh-2rem))] max-h-[min(92vh,calc(100dvh-2rem))] w-[76vw] flex-col overflow-hidden rounded-2xl border border-border bg-surface"
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
            {currentMode === 'forgot' ? (
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Quên mật khẩu</h2>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  ← Đăng nhập
                </button>
              </div>
            ) : (
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
            )}

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {registerDone ? (
                <div className="space-y-4 py-2">
                  <p className="text-sm font-medium text-center text-foreground">
                    Đăng ký thành công
                  </p>

                  <div className="rounded-lg px-4 py-4 text-center border border-border bg-surface-2">
                    <p className="text-xs mb-2 text-muted">
                      Mã khách hàng — dùng đăng nhập
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
                    Lưu mã khách hàng để đăng nhập; giao dịch gắn với số tiểu khoản (.1, .5…).
                  </p>

                  <button
                    type="button"
                    onClick={() => handleCopy(registerDone.custId)}
                    className="w-full py-2 rounded text-sm font-medium border border-border text-foreground bg-transparent transition-opacity"
                  >
                    {copied ? 'Đã copy ✓' : 'Sao chép mã khách hàng'}
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
                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
                  {currentMode === 'forgot' ? (
                    forgotStep === 'request' ? (
                      <>
                        <p className="text-xs text-muted">
                          Nhập mã khách hàng và email đã đăng ký. Hệ thống mô phỏng sẽ hiển thị mã
                          OTP (bản thật gửi qua email).
                        </p>
                        <Field label="Mã tài khoản">
                          <input
                            type="text"
                            required
                            value={forgotForm.custId}
                            onChange={(e) =>
                              setForgotForm({ ...forgotForm, custId: e.target.value.toUpperCase() })
                            }
                            className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                          />
                        </Field>
                        <Field label="Email đăng ký">
                          <input
                            type="email"
                            required
                            placeholder="example@gmail.com"
                            value={forgotForm.email}
                            onChange={(e) =>
                              setForgotForm({ ...forgotForm, email: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                          />
                        </Field>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2.5 rounded font-medium text-sm bg-primary text-white disabled:opacity-60"
                        >
                          {loading ? 'Đang gửi...' : 'Gửi mã xác thực'}
                        </button>
                      </>
                    ) : (
                      <>
                        {simulatedOtp ? (
                          <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-center">
                            <p className="text-xs text-muted">Mã OTP mô phỏng</p>
                            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-primary">
                              {simulatedOtp}
                            </p>
                          </div>
                        ) : null}
                        <Field label="Mã OTP (6 số)">
                          <input
                            type="text"
                            required
                            inputMode="numeric"
                            maxLength={6}
                            value={forgotForm.otp}
                            onChange={(e) =>
                              setForgotForm({
                                ...forgotForm,
                                otp: e.target.value.replace(/\D/g, '').slice(0, 6),
                              })
                            }
                            className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground font-mono tracking-widest"
                          />
                        </Field>
                        <Field label="Mật khẩu mới">
                          <div className="relative">
                            <input
                              type={showForgotNewPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              value={forgotForm.newPassword}
                              onChange={(e) =>
                                setForgotForm({ ...forgotForm, newPassword: e.target.value })
                              }
                              className="w-full px-3 py-2 pr-10 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                            />
                            <button
                              type="button"
                              onClick={() => setShowForgotNewPassword((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted cursor-pointer"
                            >
                              {showForgotNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                        </Field>
                        <Field label="Xác nhận mật khẩu mới">
                          <input
                            type="password"
                            required
                            value={forgotForm.confirmPassword}
                            onChange={(e) =>
                              setForgotForm({ ...forgotForm, confirmPassword: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded border border-border text-sm outline-none bg-surface-2 text-foreground"
                          />
                        </Field>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => setForgotStep('request')}
                            className="flex-1 py-2.5 rounded text-sm border border-border text-muted hover:text-foreground"
                          >
                            Quay lại
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] py-2.5 rounded font-medium text-sm bg-primary text-white disabled:opacity-60"
                          >
                            {loading ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
                          </button>
                        </div>
                      </>
                    )
                  ) : currentMode === 'login' ? (
                    <>
                      <Field label="Mã tài khoản">
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
                        <button
                          type="button"
                          onClick={openForgotPassword}
                          className="text-xs text-primary hover:underline cursor-pointer"
                        >
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

                  {currentMode !== 'forgot' ? (
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 rounded font-medium text-sm transition-opacity disabled:opacity-60 bg-primary text-white"
                    >
                      {loading ? 'Đang xử lý...' : currentMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                    </button>
                  ) : null}

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
