'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchMarketRows } from '@/store/slices/market.slice';

type OrderType = 'LO' | 'ATO' | 'ATC';
type OrderSide = 'buy' | 'sell';
type BottomTab = 'orders' | 'watchlist' | 'conditional';

export default function OrderPage() {
  const dispatch = useAppDispatch();
  const searchUniverse = useAppSelector((s) => s.market.searchUniverse);
  const marketRows = useAppSelector((s) => s.market.entities);
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedAccount = useMemo(
    () => tradingAccounts.find((a) => a.id === selectedTradingAccountId),
    [tradingAccounts, selectedTradingAccountId],
  );

  const [symbol, setSymbol] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('LO');
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [bottomTab, setBottomTab] = useState<BottomTab>('orders');

  useEffect(() => {
    if (searchUniverse.length > 0) return;
    void dispatch(fetchMarketRows({ exchange: 'ALL' }));
  }, [dispatch, searchUniverse.length]);

  useEffect(() => {
    if (symbol) return;
    if (searchUniverse.length > 0) setSymbol(searchUniverse[0].symbol);
  }, [symbol, searchUniverse]);

  const currentRow = symbol ? marketRows[symbol] : undefined;
  const accountIdLabel = selectedAccount?.accountId ?? '--';
  const isLo = orderType === 'LO';
  const canSubmit = Boolean(symbol) && Number(quantity) > 0 && (!isLo || Number(price) > 0);

  const panelCard = 'rounded-md border border-border bg-[#0b0d11]';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden bg-[#0b0d11] p-2">
      <div className="grid min-h-0 flex-[2] grid-cols-1 gap-2 xl:grid-cols-[2.2fr_1fr_1fr]">
        <section className={`${panelCard} min-h-[260px] overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-3 text-xs">
              <button className="text-price-up">Đồ thị</button>
              <button className="text-muted">Bảng giá</button>
            </div>
            <div className="text-xs text-muted">{symbol || '---'}</div>
          </div>
          <div className="flex h-[calc(100%-37px)] items-center justify-center bg-black text-xs text-muted">
            Chart panel (sẽ nối chart thật ở bước tiếp theo)
          </div>
        </section>

        <section className={`${panelCard} min-h-[260px]`}>
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground">Bước giá</p>
            <p className="text-[11px] text-muted">Lịch sử khớp lệnh</p>
          </div>
          <div className="p-3 text-xs">
            <div className="mb-2 grid grid-cols-3 text-[11px] text-muted">
              <span>Dư mua</span>
              <span className="text-center">Giá</span>
              <span className="text-right">Dư bán</span>
            </div>
            <div className="space-y-1">
              {[
                { label: 'Trần', value: currentRow?.ceil ?? 0, tone: 'text-price-ceil' },
                { label: 'TC', value: currentRow?.ref ?? 0, tone: 'text-price-ref' },
                { label: 'Sàn', value: currentRow?.floor ?? 0, tone: 'text-price-floor' },
              ].map((r) => (
                <div key={r.label} className="grid grid-cols-3 rounded bg-[#131722] px-2 py-1.5">
                  <span className="text-muted">0</span>
                  <span className={`text-center font-mono ${r.tone}`}>{r.value || '-'}</span>
                  <span className="text-right text-muted">0</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${panelCard} min-h-[260px]`}>
          <div className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
            Lệnh thường
          </div>
          <div className="space-y-3 p-3">
            <div>
              <p className="mb-1 text-[11px] text-muted">Số tài khoản</p>
              <div className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs font-mono">
                {accountIdLabel}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] text-muted">Mã CK</p>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none"
              >
                {searchUniverse.length === 0 && <option value="">Đang tải mã...</option>}
                {searchUniverse.map((item) => (
                  <option key={`${item.symbol}-${item.exchange}`} value={item.symbol}>
                    {item.symbol} · {item.exchange}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderSide('buy')}
                className={`rounded py-1.5 text-xs font-semibold ${orderSide === 'buy' ? 'bg-primary text-black' : 'border border-border text-muted'}`}
              >
                Lệnh mua
              </button>
              <button
                type="button"
                onClick={() => setOrderSide('sell')}
                className={`rounded py-1.5 text-xs font-semibold ${orderSide === 'sell' ? 'bg-price-down text-white' : 'border border-border text-muted'}`}
              >
                Lệnh bán
              </button>
            </div>

            <div>
              <p className="mb-1 text-[11px] text-muted">Khối lượng (bội số 100)</p>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="w-full rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none"
              />
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-2">
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as OrderType)}
                className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none"
              >
                <option value="LO">LO</option>
                <option value="ATO">ATO</option>
                <option value="ATC">ATC</option>
              </select>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={!isLo}
                placeholder={isLo ? 'Giá đặt' : 'Giá thị trường'}
                inputMode="decimal"
                className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none disabled:opacity-60"
              />
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              className="w-full rounded bg-primary py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {orderSide === 'buy' ? 'Xác nhận mua' : 'Xác nhận bán'}
            </button>
          </div>
        </section>
      </div>

      <section className={`${panelCard} min-h-0 flex-1 overflow-hidden`}>
        <div className="flex items-center gap-4 border-b border-border px-3 py-2 text-xs">
          <button
            type="button"
            onClick={() => setBottomTab('orders')}
            className={bottomTab === 'orders' ? 'text-primary' : 'text-muted'}
          >
            Sổ lệnh
          </button>
          <button
            type="button"
            onClick={() => setBottomTab('watchlist')}
            className={bottomTab === 'watchlist' ? 'text-primary' : 'text-muted'}
          >
            Danh mục đầu tư
          </button>
          <button
            type="button"
            onClick={() => setBottomTab('conditional')}
            className={bottomTab === 'conditional' ? 'text-primary' : 'text-muted'}
          >
            Sổ lệnh điều kiện
          </button>
        </div>

        <div className="h-[calc(100%-37px)] overflow-auto">
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
                  {bottomTab === 'orders' && 'Chưa có dữ liệu sổ lệnh. Bước tiếp theo sẽ nối API orders.'}
                  {bottomTab === 'watchlist' && 'Danh mục đầu tư sẽ triển khai sau theo kế hoạch.'}
                  {bottomTab === 'conditional' && 'Sổ lệnh điều kiện sẽ mở ở phase sau.'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
