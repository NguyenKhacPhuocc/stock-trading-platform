import type { PriceLevel, SymbolBook } from './symbol-book';

export type DepthSnapshot = {
  bid1Price?: number;
  bid1Volume?: number;
  bid2Price?: number;
  bid2Volume?: number;
  bid3Price?: number;
  bid3Volume?: number;
  ask1Price?: number;
  ask1Volume?: number;
  ask2Price?: number;
  ask2Volume?: number;
  ask3Price?: number;
  ask3Volume?: number;
};

export const BOOK_DEPTH_KEYS: (keyof DepthSnapshot)[] = [
  'bid1Price',
  'bid1Volume',
  'bid2Price',
  'bid2Volume',
  'bid3Price',
  'bid3Volume',
  'ask1Price',
  'ask1Volume',
  'ask2Price',
  'ask2Volume',
  'ask3Price',
  'ask3Volume',
];

export function aggregatePriceLevels(
  levels: readonly PriceLevel[],
  maxLevels: number,
): { price: number; volume: number }[] {
  const out: { price: number; volume: number }[] = [];
  for (let i = 0; i < levels.length && i < maxLevels; i++) {
    if (levels[i].totalQty > 0) {
      out.push({ price: levels[i].price, volume: levels[i].totalQty });
    }
  }
  return out;
}

export function summarizeBookDepth(book: SymbolBook): DepthSnapshot {
  const bids = aggregatePriceLevels(book.bidLevels, 3);
  const asks = aggregatePriceLevels(book.askLevels, 3);
  return {
    bid1Price: bids[0]?.price,
    bid1Volume: bids[0]?.volume,
    bid2Price: bids[1]?.price,
    bid2Volume: bids[1]?.volume,
    bid3Price: bids[2]?.price,
    bid3Volume: bids[2]?.volume,
    ask1Price: asks[0]?.price,
    ask1Volume: asks[0]?.volume,
    ask2Price: asks[1]?.price,
    ask2Volume: asks[1]?.volume,
    ask3Price: asks[2]?.price,
    ask3Volume: asks[2]?.volume,
  };
}
