/** Chuẩn hóa numeric TypeORM/pg (có thể là string) */
export function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Làm tròn giá theo bước giá (tick) */
export function roundToTick(price: number, tick: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (!Number.isFinite(tick) || tick <= 0) return price;
  return Math.round(price / tick) * tick;
}
