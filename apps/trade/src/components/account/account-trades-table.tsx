'use client';

import { formatDateTimeVN } from '@/lib/format-date';

type TradeItem = {
  id: string;
  tradedAt: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  tradeValue: number;
};

type AccountTradesTableProps = {
  trades: TradeItem[];
  loading: boolean;
  emptyMessage?: string;
};

export function AccountTradesTable({
  trades,
  loading,
  emptyMessage = 'Chưa có khớp lệnh trong kỳ tra cứu.',
}: AccountTradesTableProps) {
  return (
    <div className="rounded-md border border-border bg-[#0b0d11] overflow-auto">
      <table className="w-full min-w-[780px] table-fixed text-xs">
        <thead className="bg-[#11141b] text-muted">
          <tr>
            <th className="border-b border-border px-2 py-2 text-left font-medium">Thời gian</th>
            <th className="border-b border-border px-2 py-2 text-left font-medium">Mã CK</th>
            <th className="border-b border-border px-2 py-2 text-left font-medium">Mua/Bán</th>
            <th className="border-b border-border px-2 py-2 text-right font-medium">Khối lượng</th>
            <th className="border-b border-border px-2 py-2 text-right font-medium">Giá khớp</th>
            <th className="border-b border-border px-2 py-2 text-right font-medium">Giá trị</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="px-2 py-8 text-center text-muted">
                Đang tải...
              </td>
            </tr>
          ) : trades.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-2 py-8 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            trades.map((trade) => (
              <tr key={trade.id} className="border-b border-border/60">
                <td className="px-2 py-2 text-[11px] text-muted">
                  {trade.tradedAt ? formatDateTimeVN(trade.tradedAt) : '—'}
                </td>
                <td className="px-2 py-2 font-medium">{trade.symbol}</td>
                <td
                  className={`px-2 py-2 ${trade.side === 'buy' ? 'text-primary' : 'text-price-down'}`}
                >
                  {trade.side === 'buy' ? 'Mua' : 'Bán'}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {trade.quantity.toLocaleString('vi-VN')}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {trade.price.toLocaleString('vi-VN')}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {trade.tradeValue.toLocaleString('vi-VN')}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
