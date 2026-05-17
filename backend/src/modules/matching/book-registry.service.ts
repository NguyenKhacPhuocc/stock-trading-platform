import { Injectable } from '@nestjs/common';
import { SymbolBook } from './util/symbol-book';

/** Sổ lệnh in-memory theo stockId — một instance cho cả module matching. */
@Injectable()
export class BookRegistry {
  private readonly books = new Map<string, SymbolBook>();

  getBook(stockId: string): SymbolBook {
    let book = this.books.get(stockId);
    if (!book) {
      book = new SymbolBook();
      this.books.set(stockId, book);
    }
    return book;
  }
}
