import type { BottomTab } from './order-types';
import {
  formatOrderRemainingLabel,
  formatOrderStatusLabel,
} from './order-types';

type OrderMainBottomPanelProps = {
  panelCardClassName: string;
  bottomTab: BottomTab;
  onBottomTabChange: (tab: BottomTab) => void;
  orders: Array<{
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
  }>;
  isLoadingOrders: boolean;
  onCancelOrder: (id: string) => void;
  cancellingOrderId?: string | null;
};

export function OrderMainBottomPanel({
  panelCardClassName,
  bottomTab,
  onBottomTabChange,
  orders,
  isLoadingOrders,
  onCancelOrder,
  cancellingOrderId = null,
}: OrderMainBottomPanelProps) {
  return (
    <div className={`${panelCardClassName} min-h-0 overflow-hidden xl:col-span-2`}>
      <div className="flex items-center gap-4 border-b border-border px-3 text-xs">
        <button
          type="button"
          onClick={() => onBottomTabChange('orders')}
          className={`border-b-2 py-2 font-medium transition-colors ${bottomTab === 'orders'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
            }`}
        >
          Danh sách lệnh
        </button>
        <button
          type="button"
          onClick={() => onBottomTabChange('watchlist')}
          className={`border-b-2 py-2 font-medium transition-colors ${bottomTab === 'watchlist'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
            }`}
        >
          Danh mục đầu tư
        </button>
        <button
          type="button"
          onClick={() => onBottomTabChange('conditional')}
          className={`border-b-2 py-2 font-medium transition-colors ${bottomTab === 'conditional'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
            }`}
        >
          Danh sách lệnh điều kiện
        </button>
      </div>

      <div className="h-[calc(100%-37px)] overflow-auto">
        {bottomTab === 'orders' && (
          <table className="w-full min-w-[980px] table-fixed text-xs">
            <thead className="bg-[#11141b] text-muted">
              <tr>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Sửa/Hủy</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Mã lệnh</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Mua/Bán</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Số tài khoản</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Mã CK</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">KL đặt</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">Giá đặt</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Loại lệnh</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Trạng thái</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">KL còn/hủy</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">KL khớp</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">Giá khớp TB</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingOrders ? (
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-muted">
                    Đang tải danh sách lệnh...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-muted">
                    Chưa có dữ liệu sổ lệnh.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-border/60">
                    <td className="px-2 py-2">
                      {order.status === 'pending' || order.status === 'partial' ? (
                        <button
                          type="button"
                          onClick={() => onCancelOrder(order.id)}
                          disabled={cancellingOrderId === order.id}
                          className="rounded border border-border px-2 py-1 text-[11px] text-muted hover:text-foreground disabled:opacity-60"
                        >
                          {cancellingOrderId === order.id ? 'Đang hủy...' : 'Hủy'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted">--</span>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-[11px]">{order.orderCode || '--'}</td>
                    <td className={`px-2 py-2 ${order.side === 'buy' ? 'text-primary' : 'text-price-down'}`}>
                      {order.side === 'buy' ? 'Mua' : 'Bán'}
                    </td>
                    <td className="px-2 py-2">{order.accountId}</td>
                    <td className="px-2 py-2 font-medium">{order.symbol}</td>
                    <td className="px-2 py-2 text-right">{order.quantity.toLocaleString('vi-VN')}</td>
                    <td className="px-2 py-2 text-right">
                      {order.orderType === 'MAK'
                        ? 'MP'
                        : typeof order.price === 'number'
                          ? order.price.toLocaleString('vi-VN')
                          : '--'}
                    </td>
                    <td className="px-2 py-2">{order.orderType}</td>
                    <td className="px-2 py-2" title={order.status}>
                      {formatOrderStatusLabel(order.status)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {formatOrderRemainingLabel(
                        order.status,
                        order.quantity,
                        order.matchedQty,
                      ).value}
                    </td>
                    <td className="px-2 py-2 text-right">{order.matchedQty.toLocaleString('vi-VN')}</td>
                    <td className="px-2 py-2 text-right">
                      {order.matchedQty > 0 &&
                      order.avgMatchedPrice != null &&
                      Number.isFinite(order.avgMatchedPrice)
                        ? order.avgMatchedPrice.toLocaleString('vi-VN')
                        : '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {bottomTab === 'watchlist' && (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            Danh mục đầu tư sẽ triển khai sau theo kế hoạch.
          </div>
        )}

        {bottomTab === 'conditional' && (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            Sổ lệnh điều kiện sẽ mở ở phase sau.
          </div>
        )}
      </div>
    </div>
  );
}
