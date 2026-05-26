import { StockLedgerType } from '../../../common/const/stock-ledger';

export type StockStatementRowDto = {
  id: string;
  createdAt: string;
  symbol: string;
  type: StockLedgerType;
  quantityDelta: number;
  lockedDelta: number;
  quantityAfter: number;
  lockedAfter: number;
  totalAfter: number;
  description: string | null;
  refOrderId: string | null;
};

export type StockStatementSummaryDto = {
  totalIncrease: number;
  totalDecrease: number;
  netQuantity: number;
};

export type StockStatementDto = {
  accountId: string;
  items: StockStatementRowDto[];
  total: number;
  limit: number;
  offset: number;
  summary: StockStatementSummaryDto;
};
