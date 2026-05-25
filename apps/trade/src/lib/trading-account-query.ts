/** Gắn tiểu khoản đang chọn — BE dùng query/body, không suy mặc định. */
export function withTradingAccountQuery(
  path: string,
  tradingAccountId: string | null | undefined,
): string {
  if (!tradingAccountId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}tradingAccountId=${encodeURIComponent(tradingAccountId)}`;
}
