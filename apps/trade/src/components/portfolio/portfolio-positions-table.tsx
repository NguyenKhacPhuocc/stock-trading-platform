import Link from 'next/link';
import type { PortfolioPositionRow } from '@/hooks/use-portfolio-overview';
import { formatPercent, pnlColorClass } from '@/lib/portfolio-format';
import { VndAmount } from '@/components/portfolio/vnd-amount';

type PortfolioPositionsTableProps = {
  positions: PortfolioPositionRow[];
};

export function PortfolioPositionsTable({ positions }: PortfolioPositionsTableProps) {
  return (
    <div className="rounded-md border border-border bg-[#0b0d11]">
      <div className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
        Cổ phiếu đang nắm giữ
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[960px] table-fixed text-xs">
          <thead className="bg-[#11141b] text-muted">
            <tr>
              <th className="px-2 py-2 text-left font-medium">Mã CK</th>
              <th className="px-2 py-2 text-left font-medium">Sàn</th>
              <th className="px-2 py-2 text-right font-medium">KL khả dụng</th>
              <th className="px-2 py-2 text-right font-medium">KL chờ bán</th>
              <th className="px-2 py-2 text-right font-medium">Tổng KL</th>
              <th className="px-2 py-2 text-right font-medium">Giá vốn</th>
              <th className="px-2 py-2 text-right font-medium">Giá TT</th>
              <th className="px-2 py-2 text-right font-medium">Giá trị TT</th>
              <th className="px-2 py-2 text-right font-medium">Lãi/lỗ (chưa TH)</th>
              <th className="px-2 py-2 text-right font-medium">% Lãi/lỗ</th>
              <th className="px-2 py-2 text-right font-medium">Lãi/lỗ ngày</th>
              <th className="px-2 py-2 text-right font-medium">% ngày</th>
              <th className="px-2 py-2 text-center font-medium">Đặt lệnh</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-2 py-10 text-center text-muted">
                  Chưa có cổ phiếu trong danh mục.
                </td>
              </tr>
            ) : (
              positions.map((row) => {
                const pnlCls = pnlColorClass(row.unrealizedPnL);
                const dayCls = pnlColorClass(row.dayPnL);
                return (
                  <tr key={row.stockId} className="border-b border-border/60">
                    <td className="px-2 py-2 font-semibold text-foreground">
                      {row.symbol}
                    </td>
                    <td className="px-2 py-2 text-muted">{row.exchange}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.quantity.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted">
                      {row.lockedQuantity > 0
                        ? row.lockedQuantity.toLocaleString('vi-VN')
                        : '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">
                      {row.totalQuantity.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <VndAmount amount={row.avgPrice} size="xs" />
                    </td>
                    <td className={`px-2 py-2 text-right ${dayCls}`}>
                      <VndAmount amount={row.marketPrice} size="xs" className={dayCls} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <VndAmount amount={row.marketValue} size="xs" />
                    </td>
                    <td className={`px-2 py-2 text-right ${pnlCls}`}>
                      <VndAmount
                        amount={row.unrealizedPnL}
                        signed
                        size="xs"
                        className={pnlCls}
                      />
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums ${pnlCls}`}>
                      {formatPercent(row.unrealizedPnLPercent)}
                    </td>
                    <td className={`px-2 py-2 text-right ${dayCls}`}>
                      <VndAmount amount={row.dayPnL} signed size="xs" className={dayCls} />
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums ${dayCls}`}>
                      {row.dayChangePercent > 0 ? '+' : ''}
                      {row.dayChangePercent.toFixed(2)}%
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Link
                        href={`/order?symbol=${encodeURIComponent(row.symbol)}`}
                        className="text-primary hover:underline"
                      >
                        Giao dịch
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
