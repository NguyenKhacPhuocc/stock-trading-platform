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
          <div className="flex h-dvh max-h-dvh flex-col overflow-hidden" style={{ background: 'var(--background)' }}>
            <TradeHeader />
            <main className="flex flex-1 flex-col overflow-hidden">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
