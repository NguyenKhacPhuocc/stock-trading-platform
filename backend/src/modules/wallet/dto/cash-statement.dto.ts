import { TransactionType } from '../../../common/const';

export type CashStatementRowDto = {
  id: string;
  createdAt: string;
  type: TransactionType;
  amount: number;
  availableAfter: number;
  balanceAfter: number;
  description: string | null;
  refOrderId: string | null;
};

export type CashStatementSummaryDto = {
  totalIn: number;
  totalOut: number;
  netFlow: number;
};

export type CashStatementDto = {
  accountId: string;
  items: CashStatementRowDto[];
  total: number;
  limit: number;
  offset: number;
  summary: CashStatementSummaryDto;
};
