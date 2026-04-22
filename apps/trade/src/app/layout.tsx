import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/providers';
import TradeHeader from '@/components/trade-header';

export const metadata: Metadata = {
  title: 'Stock Trading Platform',
  description: 'Hệ thống giao dịch chứng khoán trực tuyến mô phỏng',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
            {/* Header của app.domain.com (luôn render kể cả khi 404) */}
            <TradeHeader />

            {/* Khi không render được route (not-found), children = null/empty nên chỉ còn header */}
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
