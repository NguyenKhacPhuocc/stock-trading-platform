'use client';

import { useRequireAuth } from '@/hooks/use-require-auth';

const panelCard = 'rounded-md border border-border bg-[#0b0d11] p-4';

export default function ContactPage() {
  useRequireAuth();

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="text-[12px] font-semibold text-foreground">Liên hệ</h1>
        </header>
        <section className={`${panelCard} grid gap-6 text-[12px] sm:grid-cols-2`}>
          <div>
            <h2 className="font-semibold text-foreground">Hỗ trợ khách hàng</h2>
            <p className="mt-2 text-muted">Hotline: 1900 0000 (mô phỏng)</p>
            <p className="text-muted">Email: support@stock-trading.demo</p>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Giờ làm việc</h2>
            <p className="mt-2 text-muted">Thứ 2 – Thứ 6: 8:00 – 17:00</p>
            <p className="text-muted">Phiên giao dịch theo lịch sàn mô phỏng</p>
          </div>
        </section>
      </div>
    </div>
  );
}
