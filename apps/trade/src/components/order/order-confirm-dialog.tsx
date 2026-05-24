'use client';

import { useEffect, useState } from 'react';
import type { OrderConfirmDisplay } from './order-types';
import { formatVnd } from './order-types';

const PIN_METHODS = [{ value: 'PIN', label: 'PIN' }] as const;

type OrderConfirmDialogProps = {
  open: boolean;
  display: OrderConfirmDisplay;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
};

export function OrderConfirmDialog({
  open,
  display,
  isSubmitting,
  onClose,
  onConfirm,
}: OrderConfirmDialogProps) {
  const [pinMethod, setPinMethod] = useState<string>(PIN_METHODS[0].value);
  const [pinCode, setPinCode] = useState('');

  useEffect(() => {
    if (!open) return;
    setPinMethod(PIN_METHODS[0].value);
    setPinCode('');
  }, [open]);

  if (!open) return null;

  const { symbol, side: orderSide, orderType, quantity, orderPrice, estimatedTotal } =
    display;
  const sideLabel = orderSide === 'buy' ? 'Mua' : 'Bán';
  const priceCell =
    orderPrice > 0
      ? orderType === 'MAK'
        ? `${formatVnd(orderPrice)} (MAK)`
        : formatVnd(orderPrice)
      : '—';
  const totalCell =
    estimatedTotal > 0 ? `${formatVnd(estimatedTotal)} đ` : '—';
  const pinValid = pinCode.length === 6;
  const canConfirm = pinValid && !isSubmitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-confirm-title"
    >
      <div className="w-full max-w-2xl rounded-md border border-border bg-[#0b0d11] p-4 text-xs shadow-lg">
        <h2 id="order-confirm-title" className="mb-3 text-sm font-semibold text-foreground">
          Xác nhận lệnh {sideLabel}
        </h2>

        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[520px] table-fixed text-xs">
            <thead className="bg-[#11141b] text-muted">
              <tr>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Mã CK</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Loại lệnh</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">
                  Khối lượng
                </th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">Giá đặt</th>
                <th className="border-b border-border px-2 py-2 text-right font-medium">
                  Tổng tiền dự kiến
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-foreground">
                <td className="px-2 py-2.5 font-semibold">{symbol}</td>
                <td className="px-2 py-2.5">{orderType}</td>
                <td className="px-2 py-2.5 text-right">
                  {quantity.toLocaleString('vi-VN')}
                </td>
                <td className="px-2 py-2.5 text-right">{priceCell}</td>
                <td className="px-2 py-2.5 text-right font-semibold text-primary">
                  {totalCell}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[11px] text-muted">
          Vui lòng kiểm tra kỹ thông tin trước khi gửi.
          {orderType === 'MAK' && (
            <span className="text-foreground">
              {' '}
              Lệnh MAK có thể khớp ngay theo sổ lệnh.
            </span>
          )}
        </p>

        <div className="mt-4 space-y-2 rounded border border-border bg-[#11141b]/60 p-3">
          <p className="text-[11px] font-medium text-foreground">Xác thực</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
            <select
              value={pinMethod}
              onChange={(e) => setPinMethod(e.target.value)}
              className="rounded border border-border bg-[#0b0d11] px-2 py-1.5 text-xs outline-none"
              aria-label="Phương thức xác thực"
            >
              {PIN_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              name="trading-pin-confirm"
              data-lpignore="true"
              data-1p-ignore
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Nhập 6 số PIN"
              className="rounded border border-border bg-[#0b0d11] px-2 py-1.5 text-xs tracking-[0.35em] outline-none [-webkit-text-security:disc]"
              aria-label="Mã PIN"
            />
          </div>
          <p className="text-[10px] text-muted">
            Nhập mã PIN giao dịch để xác nhận đặt lệnh.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 rounded border border-border py-2 font-medium text-foreground hover:bg-[#11141b] disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(pinCode)}
            className="flex-1 rounded bg-primary py-2 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi lệnh'}
          </button>
        </div>
      </div>
    </div>
  );
}
