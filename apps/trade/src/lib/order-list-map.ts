export type OrderListRow = {
  id: string;
  orderCode: string;
  side: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  matchedQty: number;
  avgMatchedPrice: number | null;
  price: number | null;
  orderType: string;
  status: string;
  accountId: string;
  createdAt?: string;
};

export function mapOrderListItem(item: Record<string, unknown>): OrderListRow {
  const ta = item.tradingAccount as { accountId?: string } | null | undefined;
  const accountId =
    typeof ta?.accountId === 'string' && ta.accountId.length > 0 ? ta.accountId : '--';
  return {
    id: String(item.id ?? ''),
    orderCode: String(item.orderCode ?? ''),
    side: (item.side === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell',
    symbol: String(
      (item.stock as { symbol?: string } | null | undefined)?.symbol ?? '',
    ),
    quantity: Number(item.quantity ?? 0),
    matchedQty: Number(item.matchedQty ?? 0),
    avgMatchedPrice:
      item.avgMatchedPrice == null ? null : Number(item.avgMatchedPrice),
    price: item.price == null ? null : Number(item.price),
    orderType: String(item.orderType ?? ''),
    status: String(item.status ?? ''),
    accountId,
    createdAt:
      typeof item.createdAt === 'string'
        ? item.createdAt
        : item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : undefined,
  };
}
