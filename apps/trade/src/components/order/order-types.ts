export type OrderType = 'LO' | 'ATO' | 'ATC';
export type OrderSide = 'buy' | 'sell';
export type BottomTab = 'orders' | 'watchlist' | 'conditional';
export type OrderEntryTab = 'regular' | 'conditional';

export type SymbolOption = {
  /** UUID cổ phiếu — lấy từ quotes (đủ kể cả khi `entities` chỉ có một sàn). */
  stockId: string;
  symbol: string;
  exchange: string;
};
