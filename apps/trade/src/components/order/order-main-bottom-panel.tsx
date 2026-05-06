import type { BottomTab } from './order-types';

type OrderMainBottomPanelProps = {
  panelCardClassName: string;
  bottomTab: BottomTab;
  onBottomTabChange: (tab: BottomTab) => void;
};

export function OrderMainBottomPanel({
  panelCardClassName,
  bottomTab,
  onBottomTabChange,
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
          <table className="w-full min-w-[900px] table-fixed text-xs">
            <thead className="bg-[#11141b] text-muted">
              <tr>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Sửa/Hủy</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Mua/Bán</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Số tài khoản</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Mã CK</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">KL đặt</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">Giá đặt</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Loại lệnh</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Trạng thái</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">KL khớp</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">Giá khớp TB</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={10} className="px-2 py-8 text-center text-muted">
                  Chưa có dữ liệu sổ lệnh. Bước tiếp theo sẽ nối API orders.
                </td>
              </tr>
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
