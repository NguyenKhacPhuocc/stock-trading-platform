import type { OrderEntryTab, OrderSide, OrderType, SymbolOption } from './order-types';
import { formatVnd } from './order-types';

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
  isMak: boolean;
  triggerOperator: 'gte' | 'lte';
  onTriggerOperatorChange: (op: 'gte' | 'lte') => void;
  triggerPrice: string;
  onTriggerPriceChange: (value: string) => void;
  canSubmit: boolean;
  quantityInvalid?: boolean;
  availableBalance?: number | null;
  sellableQuantity?: number | null;
  estimatedTotal?: number | null;
  isPreChecking?: boolean;
  isSubmitting?: boolean;
  onOpenConfirm: () => void;
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
  isMak,
  triggerOperator,
  onTriggerOperatorChange,
  triggerPrice,
  onTriggerPriceChange,
  canSubmit,
  quantityInvalid = false,
  availableBalance = null,
  sellableQuantity = null,
  estimatedTotal = null,
  isPreChecking = false,
  isSubmitting = false,
  onOpenConfirm,
}: OrderEntryPanelProps) {
  const isConditional = orderEntryTab === 'conditional';
  const busy = isPreChecking || isSubmitting;
  const submitEnabled = canSubmit && !isConditional && !busy;
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

        {orderSide === 'buy' && (
          <div className="flex min-h-[18px] justify-between text-[11px] text-muted">
            <span>Sức mua (tiền khả dụng)</span>
            <span className="font-medium text-foreground">
              {availableBalance != null ? `${formatVnd(availableBalance)} đ` : '—'}
            </span>
          </div>
        )}

        {orderSide === 'sell' && (
          <div className="flex min-h-[18px] justify-between text-[11px] text-muted">
            <span>Sức bán (cổ phiếu sở hữu)</span>
            <span className="font-medium text-foreground">
              {sellableQuantity != null
                ? sellableQuantity.toLocaleString('vi-VN')
                : '—'}
            </span>
          </div>
        )}

        <div>
          <p className="mb-1 text-[11px] text-muted">Khối lượng (bội số 100)</p>
          <input
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            inputMode="numeric"
            className={`w-full rounded border bg-[#11141b] px-2 py-1.5 text-xs outline-none ${quantityInvalid ? 'border-price-down' : 'border-border'}`}
          />
          {quantityInvalid && (
            <p className="mt-1 text-[11px] text-price-down">
              Khối lượng phải là bội số của 100 (tối thiểu 100 cổ phiếu)
            </p>
          )}
        </div>

        <div className="grid grid-cols-[100px_1fr] gap-2">
          <select
            value={orderType}
            onChange={(e) => onOrderTypeChange(e.target.value as OrderType)}
            className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none"
          >
            <option value="LO">LO</option>
            <option value="MAK">MAK</option>
          </select>
          <input
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            disabled={!isLo}
            placeholder={
              isLo ? 'Giá đặt' : isMak ? 'Giá thị trường (MAK)' : 'Giá thị trường'
            }
            inputMode="decimal"
            className="rounded border border-border bg-[#11141b] px-2 py-1.5 text-xs outline-none disabled:opacity-60"
          />
        </div>

        {orderEntryTab === 'regular' && (
          <div className="flex min-h-[18px] justify-between text-[11px] text-muted">
            <span>Tổng tiền dự kiến</span>
            <span className="font-medium text-foreground">
              {estimatedTotal != null && estimatedTotal > 0
                ? `${formatVnd(estimatedTotal)} đ`
                : '—'}
            </span>
          </div>
        )}

        {orderEntryTab === 'conditional' && (
          <p className="text-[11px] text-muted">
            Lệnh điều kiện chưa hỗ trợ — vui lòng dùng tab Lệnh thường.
          </p>
        )}

        {orderEntryTab === 'conditional' && (
          <div className="grid grid-cols-[100px_1fr] gap-2 opacity-50 pointer-events-none">
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
          disabled={!submitEnabled}
          onClick={onOpenConfirm}
          className="w-full rounded bg-primary py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPreChecking
            ? 'Đang kiểm tra...'
            : isSubmitting
              ? 'Đang gửi lệnh...'
              : isConditional
              ? 'Chưa hỗ trợ'
              : orderSide === 'buy'
                ? 'Xác nhận mua'
                : 'Xác nhận bán'}
        </button>
      </div>
    </section>
  );
}
