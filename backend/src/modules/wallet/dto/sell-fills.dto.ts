export type SellFillRowDto = {
  id: string;
  tradedAt: string;
  symbol: string;
  quantity: number;
  price: number;
  tradeValue: number;
  costBasisPrice: number;
  costAmount: number;
  realizedPnL: number;
  realizedPnLPercent: number;
};

export type SellFillsSummaryDto = {
  tradeCount: number;
  totalSellValue: number;
  totalCostAmount: number;
  totalRealizedPnL: number;
};

export type SellFillsBySymbolDto = {
  symbol: string;
  tradeCount: number;
  quantity: number;
  sellValue: number;
  costAmount: number;
  realizedPnL: number;
};

export type SellFillsDto = {
  accountId: string;
  items: SellFillRowDto[];
  total: number;
  limit: number;
  offset: number;
  summary: SellFillsSummaryDto;
  bySymbol: SellFillsBySymbolDto[];
};
