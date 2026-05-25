export type PortfolioPositionRowDto = {
  stockId: string;
  symbol: string;
  exchange: string;
  quantity: number;
  lockedQuantity: number;
  totalQuantity: number;
  avgPrice: number;
  referencePrice: number;
  marketPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayPnL: number;
  dayChangePercent: number;
};

export type PortfolioOverviewDto = {
  accountId: string;
  cash: {
    available: number;
    locked: number;
    total: number;
  };
  summary: {
    nav: number;
    totalMarketValue: number;
    totalCostBasis: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    dayPnL: number;
    dayPnLPercent: number;
    positionCount: number;
  };
  positions: PortfolioPositionRowDto[];
};
