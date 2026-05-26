/** Số dòng mỗi trang — màn tra cứu tài khoản. */
export const LIST_PAGE_SIZE = 30;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export function parsePaginated<T>(raw: unknown): PaginatedResult<T> {
  if (Array.isArray(raw)) {
    const arr = raw as T[];
    return { items: arr, total: arr.length, limit: arr.length, offset: 0 };
  }
  if (!raw || typeof raw !== 'object') {
    return { items: [], total: 0, limit: LIST_PAGE_SIZE, offset: 0 };
  }
  const o = raw as Record<string, unknown>;
  return {
    items: (Array.isArray(o.items) ? o.items : []) as T[],
    total: Number(o.total) || 0,
    limit: Number(o.limit) || LIST_PAGE_SIZE,
    offset: Number(o.offset) || 0,
  };
}

export function pageToOffset(page: number, pageSize: number): number {
  return Math.max(0, (Math.max(1, page) - 1) * pageSize);
}

export function totalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  return Math.ceil(total / pageSize);
}
