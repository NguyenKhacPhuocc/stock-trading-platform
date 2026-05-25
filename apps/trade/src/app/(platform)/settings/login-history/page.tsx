'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GATEWAY_USERS } from '@/lib/gateway-paths';
import { formatDateTimeVN } from '@/lib/format-date';
import { formatLoginIpDisplay } from '@/lib/format-login-audit';
import { defaultAuditDateRange } from '@/lib/default-date-range';
import { useRequireAuth } from '@/hooks/use-require-auth';

type LoginRow = {
  id: string;
  loginAt: string;
  ipAddress: string | null;
  channel: string;
};

const panelCard = 'rounded-md border border-border bg-[#0b0d11]';

export default function LoginHistoryPage() {
  const { handleSessionExpired } = useRequireAuth();
  const initial = defaultAuditDateRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<LoginRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(`${GATEWAY_USERS.loginHistory}?${qs}`, {
        credentials: 'same-origin',
      });
      const json = await res.json();
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không tải được dữ liệu');
      }
      setRows((json.d as LoginRow[]) ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [from, to, handleSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header>
          <h1 className="text-[12px] font-semibold text-foreground">Lịch sử đăng nhập</h1>
        </header>

        <div className="flex flex-wrap items-end gap-3 text-[12px]">
          <label className="text-muted">
            Từ ngày
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-foreground"
            />
          </label>
          <label className="text-muted">
            Đến ngày
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded bg-primary px-4 py-2 font-medium text-black disabled:opacity-50"
          >
            Tìm kiếm
          </button>
        </div>

        <section className={`${panelCard} overflow-x-auto`}>
          <table className="w-full min-w-[32rem] text-left text-[12px]">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="px-3 py-2 font-medium">Thời gian đăng nhập (GMT+7)</th>
                <th className="px-3 py-2 font-medium">Địa chỉ IP</th>
                <th className="px-3 py-2 font-medium">Kênh</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted">
                    {loading ? 'Đang tải...' : 'Không có bản ghi'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 text-foreground">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTimeVN(r.loginAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {formatLoginIpDisplay(r.ipAddress)}
                    </td>
                    <td className="px-3 py-2">{r.channel || 'Web'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
