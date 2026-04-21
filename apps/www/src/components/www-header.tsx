import Link from 'next/link';

/** URL app giao dịch (trade) — dev: cố định localhost + port */
const TRADE_APP_ORIGIN = 'http://localhost:3000';

export default function WwwHeader() {
  return (
    <header className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-white text-sm font-bold">
            ST
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Stock Trading Platform
            </span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              Môi trường mô phỏng giao dịch chứng khoán
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <a
            href={TRADE_APP_ORIGIN}
            className="text-sm font-medium px-4 py-2 rounded border"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Đăng nhập
          </a>
          <a
            href={TRADE_APP_ORIGIN}
            className="text-sm font-medium px-4 py-2 rounded"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Mở tài khoản
          </a>
        </div>
      </div>
    </header>
  );
}
