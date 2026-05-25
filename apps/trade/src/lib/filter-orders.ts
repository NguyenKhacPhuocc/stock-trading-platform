export type OrderListStatusFilter = 'all' | 'active' | 'filled' | 'cancelled';

export type OrderListRow = {
  symbol: string;
  status: string;
};

const CANCELLED_STATUSES = new Set([
  'cancelled',
  'partial_cancelled',
  'rejected',
]);

export function filterOrderRows<T extends OrderListRow>(
  rows: T[],
  statusFilter: OrderListStatusFilter,
  symbolQuery: string,
): T[] {
  const q = symbolQuery.trim().toUpperCase();
  let list = rows;
  if (q) {
    list = list.filter((o) => o.symbol.trim().toUpperCase().includes(q));
  }
  switch (statusFilter) {
    case 'active':
      return list.filter(
        (o) => o.status === 'pending' || o.status === 'partial',
      );
    case 'filled':
      return list.filter((o) => o.status === 'filled');
    case 'cancelled':
      return list.filter((o) => CANCELLED_STATUSES.has(o.status));
    default:
      return list;
  }
}
