'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ListPagination } from '@/components/ui/list-pagination';
import { GATEWAY_USERS } from '@/lib/gateway-paths';
import { formatDateTimeVN } from '@/lib/format-date';
import { defaultAuditDateRange } from '@/lib/default-date-range';
import {
  LIST_PAGE_SIZE,
  pageToOffset,
  parsePaginated,
} from '@/lib/pagination';
import { useRequireAuth } from '@/hooks/use-require-auth';

type ProfileChangeRow = {
  id: string;
  changedAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

const panelCard = 'rounded-md border border-border bg-[#0b0d11]';

function formatFieldValue(key: string, v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function summarizeChange(row: ProfileChangeRow): string {
  const before = row.before ?? {};
  const after = row.after ?? {};
  const parts: string[] = [];
  const labels: Record<string, string> = {
    fullName: 'Họ tên',
    phone: 'SĐT',
    email: 'Email',
  };
  for (const key of ['fullName', 'phone', 'email'] as const) {
    if (before[key] === after[key]) continue;
    const label = labels[key] ?? key;
    parts.push(
      `${label}: ${formatFieldValue(key, before[key])} → ${formatFieldValue(key, after[key])}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'Cập nhật thông tin';
}

export default function ProfileHistoryPage() {
  const { handleSessionExpired } = useRequireAuth();
  const initial = defaultAuditDateRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [queryFrom, setQueryFrom] = useState(initial.from);
  const [queryTo, setQueryTo] = useState(initial.to);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ProfileChangeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        from: queryFrom,
        to: queryTo,
        limit: String(LIST_PAGE_SIZE),
        offset: String(pageToOffset(page, LIST_PAGE_SIZE)),
      });
      const res = await fetch(`${GATEWAY_USERS.profileChangeHistory}?${qs}`, {
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
      const parsed = parsePaginated<ProfileChangeRow>(json.d);
      setRows(parsed.items);
      setTotal(parsed.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [queryFrom, queryTo, page, handleSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = () => {
    setQueryFrom(from);
    setQueryTo(to);
    setPage(1);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header>
          <h1 className="text-sm font-semibold text-foreground">
            Lịch sử thay đổi thông tin
          </h1>
          <p className="mt-1 text-xs text-muted">{LIST_PAGE_SIZE} dòng/trang</p>
        </header>

        <div className="flex flex-wrap items-end gap-3 text-sm">
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
            onClick={onSearch}
            disabled={loading}
            className="rounded bg-primary px-4 py-2 font-medium text-black disabled:opacity-50"
          >
            Tìm kiếm
          </button>
        </div>

        <section className={`${panelCard} overflow-x-auto`}>
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="px-3 py-2 font-medium">Thời gian</th>
                <th className="px-3 py-2 font-medium">Nội dung</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-muted">
                    {loading ? 'Đang tải...' : 'Không có bản ghi'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 text-foreground">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTimeVN(r.changedAt)}
                    </td>
                    <td className="px-3 py-2">{summarizeChange(r)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <ListPagination
            page={page}
            pageSize={LIST_PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            disabled={loading}
          />
        </section>
      </div>
    </div>
  );
}
