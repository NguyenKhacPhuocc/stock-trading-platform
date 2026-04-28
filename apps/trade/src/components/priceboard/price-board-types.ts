export type ExchangeCode = 'HOSE' | 'HNX' | 'UPCOM';

export type PriceBoardRow = {
  id: string;
  symbol: string;
  exchange: ExchangeCode;
  ref: number;
  ceil: number;
  floor: number;
  bid3: { p: number; v: number };
  bid2: { p: number; v: number };
  bid1: { p: number; v: number };
  match: {
    p: number;
    v: number;
    priceChange: number;
    priceChangePercent: number;
  };
  ask1: { p: number; v: number };
  ask2: { p: number; v: number };
  ask3: { p: number; v: number };
  totalVol: number;
  high: number;
  low: number;
};

