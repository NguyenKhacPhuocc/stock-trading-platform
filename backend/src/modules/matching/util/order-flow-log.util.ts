import type { SymbolBook } from './symbol-book';

/** Nhãn lệnh thống nhất cho log debug luồng đặt/khớp — grep: `[order-flow]`. */
export function orderRef(orderId: string, orderCode?: string | null): string {
  const code = orderCode?.trim();
  return code && code.length > 0 ? code : orderId.slice(0, 8);
}

export function formatCreateOrder(
  side: string,
  qty: number,
  symbol: string,
  price: number,
): string {
  const s = String(side).toLowerCase() === 'sell' ? 'SELL' : 'BUY';
  return `create order ${s} ${qty} ${symbol.trim().toUpperCase()} @ ${price}`;
}

export function bookDepthLine(bids: number, asks: number): string {
  return `book depth bids=${bids} asks=${asks}`;
}

export function countOrdersOnBook(book: SymbolBook): {
  bidOrders: number;
  askOrders: number;
} {
  let bidOrders = 0;
  let askOrders = 0;
  for (const lvl of book.bidLevels) bidOrders += lvl.orders.length;
  for (const lvl of book.askLevels) askOrders += lvl.orders.length;
  return { bidOrders, askOrders };
}

export function bookOrdersLine(book: SymbolBook): string {
  const { bidOrders, askOrders } = countOrdersOnBook(book);
  return `ordersOnBook bid=${bidOrders} ask=${askOrders} levels=${book.bidLevels.length}/${book.askLevels.length}`;
}
