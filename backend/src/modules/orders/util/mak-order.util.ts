import { OrderSide, OrderType } from '../../../common/const';

export function isMakOrderType(orderType: OrderType): boolean {
  return orderType === OrderType.MAK;
}

/** Giá giới hạn nội bộ để khớp MAK: mua ăn ask ≤ trần, bán ăn bid ≥ sàn. */
export function resolveMakLimitPrice(
  side: OrderSide,
  floor: number,
  ceiling: number,
): number {
  return side === OrderSide.BUY ? ceiling : floor;
}
