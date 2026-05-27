export interface AccountTradeItemDto {
  id: string;
  tradedAt: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  tradeValue: number;
}

export interface AccountTradesDto {
  accountId: string;
  items: AccountTradeItemDto[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    tradeCount: number;
    totalBuyValue: number;
    totalSellValue: number;
  };
}
