/**
 * Snapshot bảng giá kiểu “instruments” — đủ field để vẽ UI (cổ phiếu VN).
 * Đặt tên gần JSON sàn thật để map 1-1 lên component; field không có dữ liệu = 0.
 */
export interface MarketInstrumentDto {
  symbol: string;
  /** UUID nội bộ — tương đương StockId trên một số API */
  stockId: string;
  fullName: string;
  /** dd/MM/yyyy */
  tradingDate: string;
  exchange: string;
  ceiling: number;
  floor: number;
  reference: number;
  bidPrice3: number;
  bidVol3: number;
  bidPrice2: number;
  bidVol2: number;
  bidPrice1: number;
  bidVol1: number;
  offerPrice1: number;
  offerVol1: number;
  offerPrice2: number;
  offerVol2: number;
  offerPrice3: number;
  offerVol3: number;
  /** Giá khớp gần nhất trong phiên (không có thì 0) */
  closePrice: number;
  closeVol: number;
  change: number;
  changePercent: number;
  totalTrading: number;
  totalTradingValue: number;
  averagePrice: number;
  open: number;
  high: number;
  low: number;
  foreignBuy: number;
  foreignSell: number;
  foreignRemain: number;
  foreignRoom: number;
  TOTAL_OFFER_QTTY: number;
  TOTAL_BID_QTTY: number;
  tradingSessionId: string;
  /** Unix ms */
  ts: number;
  kid: string;
}
