import type { OrderEntryTab, OrderSide, OrderType, SymbolOption } from './order-types';

type OrderEntryPanelProps = {
  panelCardClassName: string;
  orderEntryTab: OrderEntryTab;
  onOrderEntryTabChange: (tab: OrderEntryTab) => void;
  accountIdLabel: string;
  symbol: string;
  symbolOptions: SymbolOption[];
  onSymbolChange: (symbol: string) => void;
  orderSide: OrderSide;
  onOrderSideChange: (side: OrderSide) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  orderType: OrderType;
  onOrderTypeChange: (orderType: OrderType) => void;
  price: string;
  onPriceChange: (value: string) => void;
  isLo: boolean;
  triggerOperator: 'gte' | 'lte';
  onTriggerOperatorChange: (op: 'gte' | 'lte') => void;
  triggerPrice: string;
  onTriggerPriceChange: (value: string) => void;
  canSubmit: boolean;
  isSubmitting?: boolean;
  onSubmitOrder: () => void;
};

export function OrderEntryPanel({
  panelCardClassName,
  orderEntryTab,
  onOrderEntryTabChange,
  accountIdLabel,
  symbol,
  symbolOptions,
  onSymbolChange,
  orderSide,
  onOrderSideChange,
  quantity,
  onQuantityChange,
  orderType,
  onOrderTypeChange,
  price,
  onPriceChange,
  isLo,
  triggerOperator,
  onTriggerOperatorChange,
  triggerPrice,
  onTriggerPriceChange,
  canSubmit,
  isSubmitting = false,
  onSubmitOrder,
}: OrderEntryPanelProps) {
  return (
    <section className={`${panelCardClassName} min-h-[260px]`}>
      <div className="flex items-center gap-4 border-b border-border px-3 text-xs">
        <button
          type="button"
          onClick={() => onOrderEntryTabChange('regular')}
          className={`border-b-2 py-2 font-medium transition-colors ${orderEntryTab === 'regular'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
            }`}
        >
          Lệnh thường
        </button>
        <button
          type="button"
          onClick={() => onOrderEntryTabChange('conditional')}
          className={`border-b-2 py-2 font-medium transition-colors ${orderEntryTab === 'conditional'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
            }`}
        >
          Lệnh điều kiện
        </button>
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
            onChange={(e) => onSymbolChange(e.target.value)}
            className="w-full rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none"
          >
            {symbolOptions.length === 0 && <option value="">Đang tải mã...</option>}
            {symbolOptions.map((item) => (
              <option key={`${item.symbol}-${item.exchange}`} value={item.symbol}>
                {item.symbol} · {item.exchange}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOrderSideChange('buy')}
            className={`rounded py-1.5 text-xs font-semibold ${orderSide === 'buy' ? 'bg-primary text-black' : 'border border-border text-muted'
              }`}
          >
            Lệnh mua
          </button>
          <button
            type="button"
            onClick={() => onOrderSideChange('sell')}
            className={`rounded py-1.5 text-xs font-semibold ${orderSide === 'sell' ? 'bg-price-down text-white' : 'border border-border text-muted'
              }`}
          >
            Lệnh bán
          </button>
        </div>

        <div>
          <p className="mb-1 text-[11px] text-muted">Khối lượng (bội số 100)</p>
          <input
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            placeholder="0"
            inputMode="numeric"
            className="w-full rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none"
          />
        </div>

        <div className="grid grid-cols-[100px_1fr] gap-2">
          <select
            value={orderType}
            onChange={(e) => onOrderTypeChange(e.target.value as OrderType)}
            className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none"
          >
            <option value="LO">LO</option>
            <option value="ATO">ATO</option>
            <option value="ATC">ATC</option>
          </select>
          <input
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            disabled={!isLo}
            placeholder={isLo ? 'Giá đặt' : 'Giá thị trường'}
            inputMode="decimal"
            className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none disabled:opacity-60"
          />
        </div>

        {orderEntryTab === 'conditional' && (
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <select
              value={triggerOperator}
              onChange={(e) => onTriggerOperatorChange(e.target.value as 'gte' | 'lte')}
              className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none"
            >
              <option value="gte">Giá {'>='}</option>
              <option value="lte">Giá {'<='}</option>
            </select>
            <input
              value={triggerPrice}
              onChange={(e) => onTriggerPriceChange(e.target.value)}
              placeholder="Giá kích hoạt"
              inputMode="decimal"
              className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none"
            />
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit || isSubmitting}
          onClick={onSubmitOrder}
          className="w-full rounded bg-primary py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? 'Đang gửi lệnh...'
            : orderEntryTab === 'regular'
            ? orderSide === 'buy'
              ? 'Xác nhận mua'
              : 'Xác nhận bán'
            : 'Tạo lệnh điều kiện'}
        </button>
      </div>
    </section>
  );
}
