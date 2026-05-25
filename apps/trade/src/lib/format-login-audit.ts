/** Hiển thị IP đã lưu — ghi chú khi dev localhost. */
export function formatLoginIpDisplay(ip: string | null): string {
  if (!ip) return '—';
  if (ip === '127.0.0.1') {
    return '127.0.0.1 (máy cục bộ / dev)';
  }
  return ip;
}
