import { memo } from 'react';
import { priceBoardGridStyle } from './price-board-utils';

/** Hai hàng header — bố cục giống stock-board MarketTable (24 cột). */
export const PriceBoardTableHeader = memo(function PriceBoardTableHeader() {
  const cell =
    'flex items-center justify-center border border-board-header-border bg-surface-2 py-0 text-[12px] font-normal text-muted';
  const group = `${cell} font-normal`;

  return (
    <div className="sticky top-0 z-20 bg-surface-2">
      <div className="grid auto-rows-[22px]" style={priceBoardGridStyle}>
        <div className={`${cell} border-x-0`} style={{ gridColumn: 1, gridRow: '1 / span 2' }}>
          Mã CK
        </div>
        <div className={`${cell} text-price-ref`} style={{ gridColumn: 2, gridRow: '1 / span 2' }}>
          TC
        </div>
        <div className={`${cell} text-price-ceil`} style={{ gridColumn: 3, gridRow: '1 / span 2' }}>
          Trần
        </div>
        <div className={`${cell} text-price-floor`} style={{ gridColumn: 4, gridRow: '1 / span 2' }}>
          Sàn
        </div>
        <div className={group} style={{ gridColumn: '5 / span 6' }}>
          Bên mua
        </div>
        <div className={group} style={{ gridColumn: '11 / span 4' }}>
          Khớp lệnh
        </div>
        <div className={group} style={{ gridColumn: '15 / span 6' }}>
          Bên bán
        </div>
        <div className={cell} style={{ gridColumn: 21, gridRow: '1 / span 2' }}>
          Tổng KL
        </div>
        <div className={group} style={{ gridColumn: '22 / span 3' }}>
          Giá
        </div>
        <div className={cell} style={{ gridColumn: 5 }}>
          Giá 3
        </div>
        <div className={cell} style={{ gridColumn: 6 }}>
          KL 3
        </div>
        <div className={cell} style={{ gridColumn: 7 }}>
          Giá 2
        </div>
        <div className={cell} style={{ gridColumn: 8 }}>
          KL 2
        </div>
        <div className={cell} style={{ gridColumn: 9 }}>
          Giá 1
        </div>
        <div className={cell} style={{ gridColumn: 10 }}>
          KL 1
        </div>
        <div className={cell} style={{ gridColumn: 11 }}>
          Giá
        </div>
        <div className={cell} style={{ gridColumn: 12 }}>
          KL
        </div>
        <div className={cell} style={{ gridColumn: 13 }}>
          +/-
        </div>
        <div className={cell} style={{ gridColumn: 14 }}>
          +/- (%)
        </div>
        <div className={cell} style={{ gridColumn: 15 }}>
          Giá 1
        </div>
        <div className={cell} style={{ gridColumn: 16 }}>
          KL 1
        </div>
        <div className={cell} style={{ gridColumn: 17 }}>
          Giá 2
        </div>
        <div className={cell} style={{ gridColumn: 18 }}>
          KL 2
        </div>
        <div className={cell} style={{ gridColumn: 19 }}>
          Giá 3
        </div>
        <div className={cell} style={{ gridColumn: 20 }}>
          KL 3
        </div>
        <div className={cell} style={{ gridColumn: 22 }}>
          Cao
        </div>
        <div className={cell} style={{ gridColumn: 23 }}>
          TB
        </div>
        <div className={cell} style={{ gridColumn: 24 }}>
          Thấp
        </div>
      </div>
    </div>
  );
});
