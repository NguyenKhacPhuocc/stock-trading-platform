type OrderTradeHistoryPanelProps = {
  panelCardClassName: string;
};

export function OrderTradeHistoryPanel({ panelCardClassName }: OrderTradeHistoryPanelProps) {
  return (
    <aside className={`${panelCardClassName} min-h-0 overflow-hidden`}>
      <div className="border-b border-border px-3 py-[9px] text-xs font-semibold text-foreground">
        Lịch sử khớp lệnh
      </div>
      <div className="h-[calc(100%-37px)] overflow-auto">
        <table className="w-full min-w-[280px] table-fixed text-xs">
          <thead className="bg-[#11141b] text-muted">
            <tr>
              <th className="border-b border-border px-2 py-2 text-left font-medium">Giá</th>
              <th className="border-b border-border px-2 py-2 text-right font-medium">KL</th>
              <th className="border-b border-border px-2 py-2 text-right font-medium">Giờ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="px-2 py-8 text-center text-muted">
                Lịch sử khớp lệnh sẽ hiển thị khi có dữ liệu thực tế từ API.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </aside>
  );
}
