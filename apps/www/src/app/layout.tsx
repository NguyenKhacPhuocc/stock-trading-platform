import type { Metadata } from 'next';
import './globals.css';
import WwwHeader from '@/components/www-header';

export const metadata: Metadata = {
  title: 'Stock Trading Platform',
  description: 'Hệ thống giao dịch chứng khoán trực tuyến mô phỏng',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
          <WwwHeader />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
