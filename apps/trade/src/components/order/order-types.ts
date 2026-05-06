export type OrderType = 'LO' | 'ATO' | 'ATC';
export type OrderSide = 'buy' | 'sell';
export type BottomTab = 'orders' | 'watchlist' | 'conditional';
export type OrderEntryTab = 'regular' | 'conditional';

export type SymbolOption = {
  symbol: string;
  exchange: string;
};
