import { IsNull, Repository } from 'typeorm';
import { Trade } from '../../../database/entities/trade.entity';
import { Position } from '../../../database/entities/position.entity';

/** Tính lại cost_basis_price / realized_pnl cho khớp bán cũ (trước khi có cột). */
export async function backfillMissingTradeRealizedPnl(
  tradeRepo: Repository<Trade>,
  positionRepo: Repository<Position>,
): Promise<number> {
  const nullCount = await tradeRepo.count({
    where: { costBasisPrice: IsNull() },
  });
  if (nullCount === 0) return 0;

  const pairs = await tradeRepo
    .createQueryBuilder('t')
    .leftJoin('t.sellOrder', 'sell')
    .leftJoin('t.buyOrder', 'buy')
    .select('t.stock_id', 'stockId')
    .addSelect('sell.trading_account_id', 'sellAid')
    .addSelect('buy.trading_account_id', 'buyAid')
    .where('t.cost_basis_price IS NULL')
    .andWhere('t.stock_id IS NOT NULL')
    .getRawMany<{ stockId: string; sellAid: string | null; buyAid: string | null }>();

  const keys = new Set<string>();
  for (const row of pairs) {
    if (row.sellAid) keys.add(`${row.sellAid}:${row.stockId}`);
    if (row.buyAid) keys.add(`${row.buyAid}:${row.stockId}`);
  }

  let updated = 0;
  for (const key of keys) {
    const [accountId, stockId] = key.split(':');
    updated += await backfillAccountStock(
      tradeRepo,
      positionRepo,
      accountId,
      stockId,
    );
  }
  return updated;
}

async function backfillAccountStock(
  tradeRepo: Repository<Trade>,
  positionRepo: Repository<Position>,
  tradingAccountId: string,
  stockId: string,
): Promise<number> {
  const trades = await tradeRepo
    .createQueryBuilder('t')
    .leftJoinAndSelect('t.buyOrder', 'buy')
    .leftJoinAndSelect('t.sellOrder', 'sell')
    .where('t.stock_id = :stockId', { stockId })
    .andWhere(
      '(buy.trading_account_id = :aid OR sell.trading_account_id = :aid)',
      { aid: tradingAccountId },
    )
    .orderBy('t.created_at', 'ASC')
    .getMany();

  if (trades.length === 0) return 0;

  let qty = 0;
  let wac = 0;
  let updated = 0;

  const pos = await positionRepo.findOne({
    where: { tradingAccountId, stockId },
  });
  let buyQty = 0;
  let sellQty = 0;
  for (const t of trades) {
    const mq = Number(t.quantity) || 0;
    if (t.buyOrder?.tradingAccountId === tradingAccountId) buyQty += mq;
    if (t.sellOrder?.tradingAccountId === tradingAccountId) sellQty += mq;
  }
  const posQty = pos ? Number(pos.quantity) || 0 : 0;
  const posAvg = pos ? Number(pos.avgPrice) || 0 : 0;
  const openingQty = posQty + sellQty - buyQty;
  if (openingQty > 0 && posAvg > 0) {
    qty = openingQty;
    wac = posAvg;
  }

  for (const t of trades) {
    const mq = Number(t.quantity) || 0;
    const px = Number(t.price) || 0;
    const isBuy = t.buyOrder?.tradingAccountId === tradingAccountId;
    const isSell = t.sellOrder?.tradingAccountId === tradingAccountId;

    if (isBuy && mq > 0) {
      const oldQty = qty;
      qty += mq;
      wac = oldQty <= 0 ? px : (oldQty * wac + mq * px) / qty;
    }

    if (isSell && mq > 0) {
      const storedCost = t.costBasisPrice != null ? Number(t.costBasisPrice) : 0;
      const basis = storedCost > 0 ? storedCost : wac > 0 && qty > 0 ? wac : posAvg;

      if (t.costBasisPrice == null && basis > 0) {
        const realized = (px - basis) * mq;
        await tradeRepo.update(t.id, {
          costBasisPrice: basis,
          realizedPnL: realized,
        });
        updated += 1;
      }

      qty = Math.max(0, qty - mq);
      if (qty === 0) wac = 0;
    }
  }

  return updated;
}
