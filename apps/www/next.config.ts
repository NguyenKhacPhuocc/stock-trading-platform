import type { NextConfig } from 'next';
import path from 'path';

// Trong monorepo Turbopack cần root chuẩn, tránh watch file lệch → biên dịch lặp / badge "Compiling..." kẹt
const monorepoRoot = path.resolve(__dirname, '../..');

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
  // Badge góc màn hình dev hay bám "Compiling" dù trang đã xong; tắt giao diện, lỗi build vẫn hiện terminal
  devIndicators: false,
};

export default nextConfig;
