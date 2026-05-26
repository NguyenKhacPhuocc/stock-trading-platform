'use client';

import { totalPages } from '@/lib/pagination';

type ListPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
}: ListPaginationProps) {
  const pages = totalPages(total, pageSize);
  const safePage = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted">
      <span>
        {total === 0
          ? 'Không có dữ liệu'
          : `Hiển thị ${from}–${to} / ${total.toLocaleString('vi-VN')}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="rounded border border-border px-2.5 py-1 hover:bg-surface-2 disabled:opacity-40"
        >
          Trước
        </button>
        <span className="min-w-[5rem] text-center tabular-nums">
          {safePage} / {pages}
        </span>
        <button
          type="button"
          disabled={disabled || safePage >= pages}
          onClick={() => onPageChange(safePage + 1)}
          className="rounded border border-border px-2.5 py-1 hover:bg-surface-2 disabled:opacity-40"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
