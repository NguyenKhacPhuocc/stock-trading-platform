'use client';

import { useTradeHistory } from '@/hooks/use-trade-history';
import { formatTimeHHmmss } from '@/lib/format-date';
import { useAppSelector } from '@/store/hooks';

type OrderTradeHistoryPanelProps = {
  panelCardClassName: string;
  stockId: string;
  symbol: string;
};

export function OrderTradeHistoryPanel({
  panelCardClassName,
  stockId,
  symbol,
}: OrderTradeHistoryPanelProps) {
  const { items, isLoading, error } = useTradeHistory({
    stockId,
    limit: 20,
  });

  // Lấy reference price từ Redux
  const marketEntities = useAppSelector((s) => s.market.entities);
  const refPrice = marketEntities[symbol.toUpperCase()]?.ref ?? 0;

  const getPriceColor = (price: number): string => {
    if (refPrice === 0) return 'text-foreground'; // Không có ref → mặc định
    if (price > refPrice) return 'text-green-500'; // Tăng → xanh
    if (price < refPrice) return 'text-red-500'; // Giảm → đỏ
    return 'text-foreground'; // Bằng → mặc định
  };

  return (
    <aside className={`${panelCardClassName} min-h-0 overflow-hidden`}>
      <div className="border-b border-border px-3 py-[9px] text-xs font-semibold text-foreground">
        Lịch sử khớp lệnh
      </div>
      <div className="h-[calc(100%-37px)] overflow-auto">
        <table className="w-full min-w-[280px] table-fixed text-xs">
          <thead className="sticky top-0 bg-[#11141b] text-muted">
            <tr>
              <th className="border-b border-border px-2 py-2 text-left font-medium">
                Giá
              </th>
              <th className="border-b border-border px-2 py-2 text-right font-medium">
                KL
              </th>
              <th className="border-b border-border px-2 py-2 text-right font-medium">
                Giờ
              </th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-center text-red-500">
                  Lỗi: {error}
                </td>
              </tr>
            )}
            {isLoading && items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-center text-muted">
                  Đang tải...
                </td>
              </tr>
            )}
            {items.length === 0 && !isLoading && !error && (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-center text-muted">
                  Chưa có lịch sử khớp lệnh
                </td>
              </tr>
            )}
            {items.map((item, idx) => (
              <tr
                key={idx}
                className="border-b border-border hover:bg-[#1a1f2e] transition-colors"
              >
                <td className={`px-2 py-1.5 text-left font-semibold ${getPriceColor(item.price)}`}>
                  {item.price.toLocaleString('vi-VN', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  {item.quantity.toLocaleString('vi-VN')}
                </td>
                <td className="px-2 py-1.5 text-right text-muted">
                  {formatTimeHHmmss(item.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
