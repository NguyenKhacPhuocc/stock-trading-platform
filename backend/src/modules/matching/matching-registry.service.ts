import { Injectable } from '@nestjs/common';
import { SymbolBook } from './symbol-book';

/** Book in-memory theo stockId — authoritative cho khớp; mất khi restart process (demo). */
@Injectable()
export class MatchingRegistryService {
  private readonly books = new Map<string, SymbolBook>();

  getBook(stockId: string): SymbolBook {
    let b = this.books.get(stockId);
    if (!b) {
      b = new SymbolBook();
      this.books.set(stockId, b);
    }
    return b;
  }
}
