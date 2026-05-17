import { OrderSide } from '../../../common/const';
import type { QueuedOrder, TradeFillPlan } from '../dto/matching.dto';

export type PriceLevel = {
  readonly price: number;
  totalQty: number;
  readonly orders: QueuedOrder[];
};

export type SymbolBookSnapshot = {
  bids: QueuedOrder[];
  asks: QueuedOrder[];
};

/** Sổ lệnh một mã — price-time priority (in-memory). */
export class SymbolBook {
  readonly bidLevels: PriceLevel[] = [];
  readonly askLevels: PriceLevel[] = [];

  private readonly orderIndex = new Map<
    string,
    { side: OrderSide; price: number }
  >();

  private priceIdx(levels: PriceLevel[], price: number, desc: boolean): number {
    let lo = 0;
    let hi = levels.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const cmp = desc ? levels[mid].price > price : levels[mid].price < price;
      if (cmp) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private getOrCreateLevel(
    levels: PriceLevel[],
    price: number,
    desc: boolean,
  ): PriceLevel {
    const idx = this.priceIdx(levels, price, desc);
    if (idx < levels.length && levels[idx].price === price) {
      return levels[idx];
    }
    const lvl: PriceLevel = { price, totalQty: 0, orders: [] };
    levels.splice(idx, 0, lvl);
    return lvl;
  }

  private findLevel(
    levels: PriceLevel[],
    price: number,
    desc: boolean,
  ): PriceLevel | undefined {
    const idx = this.priceIdx(levels, price, desc);
    return idx < levels.length && levels[idx].price === price
      ? levels[idx]
      : undefined;
  }

  private removeLevelIfEmpty(
    levels: PriceLevel[],
    price: number,
    desc: boolean,
  ): void {
    const idx = this.priceIdx(levels, price, desc);
    if (
      idx < levels.length &&
      levels[idx].price === price &&
      levels[idx].orders.length === 0
    ) {
      levels.splice(idx, 1);
    }
  }

  rest(o: QueuedOrder): void {
    if (o.remainingQty <= 0) return;
    const desc = o.side === OrderSide.BUY;
    const lvl = this.getOrCreateLevel(
      desc ? this.bidLevels : this.askLevels,
      o.price,
      desc,
    );
    lvl.orders.push(o);
    lvl.totalQty += o.remainingQty;
    this.orderIndex.set(o.orderId, { side: o.side, price: o.price });
  }

  removeOrder(orderId: string): boolean {
    const info = this.orderIndex.get(orderId);
    if (!info) return false;
    const desc = info.side === OrderSide.BUY;
    const levels = desc ? this.bidLevels : this.askLevels;
    const lvl = this.findLevel(levels, info.price, desc);
    if (!lvl) {
      this.orderIndex.delete(orderId);
      return false;
    }
    const oi = lvl.orders.findIndex((o) => o.orderId === orderId);
    if (oi < 0) {
      this.orderIndex.delete(orderId);
      return false;
    }
    lvl.totalQty -= lvl.orders[oi].remainingQty;
    lvl.orders.splice(oi, 1);
    this.orderIndex.delete(orderId);
    if (lvl.orders.length === 0) {
      this.removeLevelIfEmpty(levels, info.price, desc);
    }
    return true;
  }

  matchIncoming(incoming: QueuedOrder): {
    fills: TradeFillPlan[];
    remainder: QueuedOrder | null;
    removedOrderIds: string[];
  } {
    const fills: TradeFillPlan[] = [];
    const removedOrderIds: string[] = [];
    const q: QueuedOrder = { ...incoming };

    if (incoming.side === OrderSide.BUY) {
      outer: while (q.remainingQty > 0) {
        for (let li = 0; li < this.askLevels.length; li++) {
          const lvl = this.askLevels[li];
          if (lvl.price > q.price) break outer;

          for (let oi = 0; oi < lvl.orders.length; oi++) {
            const best = lvl.orders[oi];
            if (best.tradingAccountId === q.tradingAccountId) continue;

            const mq = Math.min(q.remainingQty, best.remainingQty);
            fills.push({
              buyOrderId: q.orderId,
              sellOrderId: best.orderId,
              quantity: mq,
              price: best.price,
              buyerAccountId: q.tradingAccountId,
              sellerAccountId: best.tradingAccountId,
            });
            q.remainingQty -= mq;
            best.remainingQty -= mq;
            lvl.totalQty -= mq;

            if (best.remainingQty <= 0) {
              removedOrderIds.push(best.orderId);
              lvl.orders.splice(oi, 1);
              this.orderIndex.delete(best.orderId);
              if (lvl.orders.length === 0) this.askLevels.splice(li, 1);
            }
            continue outer;
          }
        }
        break;
      }
    } else {
      outer: while (q.remainingQty > 0) {
        for (let li = 0; li < this.bidLevels.length; li++) {
          const lvl = this.bidLevels[li];
          if (lvl.price < q.price) break outer;

          for (let oi = 0; oi < lvl.orders.length; oi++) {
            const best = lvl.orders[oi];
            if (best.tradingAccountId === q.tradingAccountId) continue;

            const mq = Math.min(q.remainingQty, best.remainingQty);
            fills.push({
              buyOrderId: best.orderId,
              sellOrderId: q.orderId,
              quantity: mq,
              price: best.price,
              buyerAccountId: best.tradingAccountId,
              sellerAccountId: q.tradingAccountId,
            });
            q.remainingQty -= mq;
            best.remainingQty -= mq;
            lvl.totalQty -= mq;

            if (best.remainingQty <= 0) {
              removedOrderIds.push(best.orderId);
              lvl.orders.splice(oi, 1);
              this.orderIndex.delete(best.orderId);
              if (lvl.orders.length === 0) this.bidLevels.splice(li, 1);
            }
            continue outer;
          }
        }
        break;
      }
    }

    return { fills, remainder: q.remainingQty > 0 ? q : null, removedOrderIds };
  }

  snapshot(): SymbolBookSnapshot {
    const bids: QueuedOrder[] = [];
    const asks: QueuedOrder[] = [];
    for (const lvl of this.bidLevels)
      for (const o of lvl.orders) bids.push({ ...o });
    for (const lvl of this.askLevels)
      for (const o of lvl.orders) asks.push({ ...o });
    return { bids, asks };
  }

  restore(s: SymbolBookSnapshot): void {
    this.bidLevels.length = 0;
    this.askLevels.length = 0;
    this.orderIndex.clear();
    for (const o of s.bids) this.rest({ ...o });
    for (const o of s.asks) this.rest({ ...o });
  }
}
