import type { SymbolBook } from '../util/symbol-book';

export type BookUpdatedPayload = {
  symbol: string;
  stockId: string;
  book: SymbolBook;
  lastTradePrice: number | null;
  lastMatchedQty: number;
  fillsCount: number;
};

export type BookCancelledPayload = {
  symbol: string;
  stockId: string;
  book: SymbolBook;
};
