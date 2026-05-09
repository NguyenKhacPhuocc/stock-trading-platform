'use client';

import { useAppSelector } from '@/store/hooks';

export default function SessionHydrationGate({ children }: { children: React.ReactNode }) {
  const isHydratingSession = useAppSelector((s) => s.auth.isHydratingSession);

  if (!isHydratingSession) {
    return <>{children}</>;
  }

  return (
    <div
      className="flex h-dvh w-full items-center justify-center"
      style={{ background: 'var(--background)' }}
      aria-label="Đang tải phiên đăng nhập"
      role="status"
    >
      <div className="flex flex-col items-center gap-5 rounded-2xl border px-10 py-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-base font-bold text-black">ST</div>
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/80 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/70 [animation-delay:240ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 [animation-delay:360ms]" />
        </div>
      </div>
    </div>
  );
}
