import type { NextConfig } from 'next';
import path from 'path';

const monorepoRoot = path.resolve(__dirname, '../..');

const nextConfig: NextConfig = {
  reactCompiler: true,
  basePath: '/trade',
  assetPrefix: '/trade',
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002',
    NEXT_PUBLIC_WS_URL:
      process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3002',
  },
  turbopack: {
    root: monorepoRoot,
  },
  devIndicators: false,
  // basePath khiến app chỉ mount dưới /trade — gốc "/" cần redirect thẳng (không qua proxy)
  async redirects() {
    return [
      {
        source: '/',
        destination: '/trade/priceboard',
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
