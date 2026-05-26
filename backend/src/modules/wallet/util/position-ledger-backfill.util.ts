import { Repository } from 'typeorm';
import { OrderSide, OrderStatus } from '../../../common/const';
import { StockLedgerType } from '../../../common/const/stock-ledger';
import { Order } from '../../../database/entities/order.entity';
import { Trade } from '../../../database/entities/trade.entity';
import { Position } from '../../../database/entities/position.entity';
import { PositionTransaction } from '../../../database/entities/position-transaction.entity';
import { recordPositionLedger } from '../../../common/utils/record-position-ledger.util';

type LedgerEvent = {
  at: Date;
  kind: 'gift' | 'sell_lock' | 'sell_unlock' | 'buy' | 'sell_match';
  qty: number;
  orderId?: string;
  tradeId?: string;
  price?: number;
  description?: string;
};

/** Tái tạo sổ CP từ lịch sử lệnh/khớp (dữ liệu trước khi có bảng ledger). */
export async function backfillPositionLedgerForAccount(
  ledgerRepo: Repository<PositionTransaction>,
  orderRepo: Repository<Order>,
  tradeRepo: Repository<Trade>,
  positionRepo: Repository<Position>,
  tradingAccountId: string,
): Promise<number> {
  const existing = await ledgerRepo.count({ where: { tradingAccountId } });
  if (existing > 0) return 0;

  const positions = await positionRepo.find({
    where: { tradingAccountId },
  });
  const stockIds = new Set<string>(positions.map((p) => p.stockId));

  const trades = await tradeRepo
    .createQueryBuilder('t')
    .leftJoinAndSelect('t.buyOrder', 'buy')
    .leftJoinAndSelect('t.sellOrder', 'sell')
    .where('buy.trading_account_id = :aid OR sell.trading_account_id = :aid', {
      aid: tradingAccountId,
    })
    .orderBy('t.created_at', 'ASC')
    .getMany();
  for (const t of trades) {
    if (t.stockId) stockIds.add(t.stockId);
  }

  const orders = await orderRepo.find({
    where: { tradingAccountId, side: OrderSide.SELL },
    order: { createdAt: 'ASC' },
  });

  let written = 0;
  for (const stockId of stockIds) {
    written += await replayStock(
      ledgerRepo.manager,
      positionRepo,
      tradingAccountId,
      stockId,
      orders.filter((o) => o.stockId === stockId),
      trades.filter((t) => t.stockId === stockId),
    );
  }
  return written;
}

async function replayStock(
  manager: Repository<PositionTransaction>['manager'],
  positionRepo: Repository<Position>,
  tradingAccountId: string,
  stockId: string,
  sellOrders: Order[],
  trades: Trade[],
): Promise<number> {
  const events: LedgerEvent[] = [];

  for (const o of sellOrders) {
    const q = Number(o.quantity) || 0;
    if (q <= 0) continue;
    events.push({
      at: o.createdAt,
      kind: 'sell_lock',
      qty: q,
      orderId: o.id,
      description: `Phong tỏa bán ${q} (khôi phục)`,
    });
    if (o.status === OrderStatus.CANCELLED && o.cancelledAt) {
      const matched = Number(o.matchedQty) || 0;
      const rem = q - matched;
      if (rem > 0) {
        events.push({
          at: o.cancelledAt,
          kind: 'sell_unlock',
          qty: rem,
          orderId: o.id,
          description: `Hủy lệnh bán — hoàn ${rem} CP`,
        });
      }
    }
  }

  for (const t of trades) {
    const mq = Number(t.quantity) || 0;
    const px = Number(t.price) || 0;
    if (t.buyOrder?.tradingAccountId === tradingAccountId) {
      events.push({
        at: t.createdAt,
        kind: 'buy',
        qty: mq,
        tradeId: t.id,
        orderId: t.buyOrderId,
        price: px,
        description: `Khớp mua ${mq} @ ${px}`,
      });
    }
    if (t.sellOrder?.tradingAccountId === tradingAccountId) {
      events.push({
        at: t.createdAt,
        kind: 'sell_match',
        qty: mq,
        tradeId: t.id,
        orderId: t.sellOrderId,
        price: px,
        description: `Khớp bán ${mq} @ ${px}`,
      });
    }
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  if (events.length === 0) return 0;

  let qty = 0;
  let locked = 0;
  let written = 0;

  const pos = await positionRepo.findOne({
    where: { tradingAccountId, stockId },
  });
  let buyQty = 0;
  let sellMatchQty = 0;
  for (const t of trades) {
    const mq = Number(t.quantity) || 0;
    if (t.buyOrder?.tradingAccountId === tradingAccountId) buyQty += mq;
    if (t.sellOrder?.tradingAccountId === tradingAccountId) sellMatchQty += mq;
  }
  const posQty = pos ? Number(pos.quantity) || 0 : 0;
  const posLocked = pos ? Number(pos.lockedQuantity) || 0 : 0;
  const openingQty = posQty + posLocked + sellMatchQty - buyQty;
  if (openingQty > 0) {
    const giftQty = openingQty;
    qty = giftQty;
    await recordPositionLedger(manager, {
      tradingAccountId,
      stockId,
      type: StockLedgerType.GIFT,
      quantityDelta: giftQty,
      lockedDelta: 0,
      quantityAfter: qty,
      lockedAfter: locked,
      description: `Quà / tồn mở đầu ${giftQty} CP (khôi phục)`,
    });
    written += 1;
  }

  for (const ev of events) {
    if (ev.kind === 'sell_lock') {
      qty -= ev.qty;
      locked += ev.qty;
      await recordPositionLedger(manager, {
        tradingAccountId,
        stockId,
        type: StockLedgerType.SELL_LOCK,
        quantityDelta: -ev.qty,
        lockedDelta: ev.qty,
        quantityAfter: qty,
        lockedAfter: locked,
        refOrderId: ev.orderId,
        description: ev.description,
      });
      written += 1;
    } else if (ev.kind === 'sell_unlock') {
      qty += ev.qty;
      locked -= ev.qty;
      await recordPositionLedger(manager, {
        tradingAccountId,
        stockId,
        type: StockLedgerType.SELL_UNLOCK,
        quantityDelta: ev.qty,
        lockedDelta: -ev.qty,
        quantityAfter: qty,
        lockedAfter: locked,
        refOrderId: ev.orderId,
        description: ev.description,
      });
      written += 1;
    } else if (ev.kind === 'buy') {
      qty += ev.qty;
      await recordPositionLedger(manager, {
        tradingAccountId,
        stockId,
        type: StockLedgerType.BUY_MATCHED,
        quantityDelta: ev.qty,
        lockedDelta: 0,
        quantityAfter: qty,
        lockedAfter: locked,
        refOrderId: ev.orderId,
        refTradeId: ev.tradeId,
        description: ev.description,
      });
      written += 1;
    } else if (ev.kind === 'sell_match') {
      locked -= ev.qty;
      await recordPositionLedger(manager, {
        tradingAccountId,
        stockId,
        type: StockLedgerType.SELL_MATCHED,
        quantityDelta: 0,
        lockedDelta: -ev.qty,
        quantityAfter: qty,
        lockedAfter: locked,
        refOrderId: ev.orderId,
        refTradeId: ev.tradeId,
        description: ev.description,
      });
      written += 1;
    }
  }

  return written;
}
