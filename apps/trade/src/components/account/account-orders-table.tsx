'use client';

import { formatOrderStatusLabel } from '@/components/order/order-types';
import type { OrderListRow } from '@/lib/order-list-map';
import { formatDateTimeVN } from '@/lib/format-date';

type AccountOrdersTableProps = {
  orders: OrderListRow[];
  loading: boolean;
  emptyMessage?: string;
};

export function AccountOrdersTable({
  orders,
  loading,
  emptyMessage = 'Chưa có lệnh trong kỳ tra cứu.',
}: AccountOrdersTableProps) {
  return (
    <div className="rounded-md border border-border bg-[#0b0d11] overflow-auto">
      <table className="w-full min-w-[920px] table-fixed text-xs">
        <thead className="bg-[#11141b] text-muted">
          <tr>
            <th className="border-b border-border px-2 py-2 text-left font-medium">Thời gian</th>
            <th className="border-b border-border px-2 py-2 text-left font-medium">Mã lệnh</th>
            <th className="border-b border-border px-2 py-2 text-left font-medium">Mua/Bán</th>
            <th className="border-b border-border px-2 py-2 text-left font-medium">Mã CK</th>
            <th className="border-b border-border px-2 py-2 text-right font-medium">KL đặt</th>
            <th className="border-b border-border px-2 py-2 text-right font-medium">Giá đặt</th>
            <th className="border-b border-border px-2 py-2 text-left font-medium">Loại</th>
            <th className="border-b border-border px-2 py-2 text-left font-medium">Trạng thái</th>
            <th className="border-b border-border px-2 py-2 text-right font-medium">KL khớp</th>
            <th className="border-b border-border px-2 py-2 text-right font-medium">Giá khớp TB</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={10} className="px-2 py-8 text-center text-muted">
                Đang tải...
              </td>
            </tr>
          ) : orders.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-2 py-8 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="border-b border-border/60">
                <td className="px-2 py-2 text-[11px] text-muted">
                  {order.createdAt ? formatDateTimeVN(order.createdAt) : '—'}
                </td>
                <td className="px-2 py-2 font-mono text-[11px]">{order.orderCode || '—'}</td>
                <td
                  className={`px-2 py-2 ${order.side === 'buy' ? 'text-primary' : 'text-price-down'}`}
                >
                  {order.side === 'buy' ? 'Mua' : 'Bán'}
                </td>
                <td className="px-2 py-2 font-medium">{order.symbol}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {order.quantity.toLocaleString('vi-VN')}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {order.orderType === 'MAK'
                    ? 'MP'
                    : typeof order.price === 'number'
                      ? order.price.toLocaleString('vi-VN')
                      : '—'}
                </td>
                <td className="px-2 py-2">{order.orderType}</td>
                <td className="px-2 py-2">{formatOrderStatusLabel(order.status)}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {order.matchedQty.toLocaleString('vi-VN')}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {order.matchedQty > 0 &&
                  order.avgMatchedPrice != null &&
                  Number.isFinite(order.avgMatchedPrice)
                    ? order.avgMatchedPrice.toLocaleString('vi-VN')
                    : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
