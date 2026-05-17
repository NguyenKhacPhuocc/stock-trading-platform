import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';
import { OrderStatus, OrderSide, TransactionType } from '../../common/const';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import type { TradeFillPlan } from './dto/matching.dto';
import type { OrderFillNotify } from './dto/order-fill-notify.dto';

/** Ghi khớp lệnh: orders, trades, ví, position. */
@Injectable()
export class TradeFillService {
  constructor(private readonly dataSource: DataSource) {}

  async applyFills(
    fills: TradeFillPlan[],
  ): Promise<{ lastTradePrice: number | null; notifies: OrderFillNotify[] }> {
    if (fills.length === 0) return { lastTradePrice: null, notifies: [] };

    let lastPx: number | null = null;
    const notifies: OrderFillNotify[] = [];
    const seenOrderIds = new Set<string>();
    await this.dataSource.transaction(async (manager) => {
      for (const fill of fills) {
        lastPx = await this.applyOneFill(manager, fill, notifies, seenOrderIds);
      }
    });
    return { lastTradePrice: lastPx, notifies };
  }

  private async applyOneFill(
    manager: EntityManager,
    fill: TradeFillPlan,
    notifies: OrderFillNotify[],
    seenOrderIds: Set<string>,
  ): Promise<number> {
    const buyOrder = await manager.findOne(Order, {
      where: { id: fill.buyOrderId },
      lock: { mode: 'pessimistic_write' },
    });
    const sellOrder = await manager.findOne(Order, {
      where: { id: fill.sellOrderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!buyOrder || !sellOrder) {
      throw new Error('Không tìm thấy lệnh khớp');
    }
    if (buyOrder.stockId !== sellOrder.stockId) {
      throw new Error('stockId lệnh mua/bán không khớp');
    }

    const mq = fill.quantity;
    const px = fill.price;
    const tradeValue = mq * px;

    const buyRem = Number(buyOrder.quantity) - Number(buyOrder.matchedQty);
    const sellRem = Number(sellOrder.quantity) - Number(sellOrder.matchedQty);
    if (buyRem < mq || sellRem < mq) {
      throw new Error('Khối lượng khớp vượt phần còn lại');
    }

    buyOrder.matchedQty = Number(buyOrder.matchedQty) + mq;
    sellOrder.matchedQty = Number(sellOrder.matchedQty) + mq;

    buyOrder.status =
      buyOrder.matchedQty >= Number(buyOrder.quantity)
        ? OrderStatus.FILLED
        : OrderStatus.PARTIAL;
    sellOrder.status =
      sellOrder.matchedQty >= Number(sellOrder.quantity)
        ? OrderStatus.FILLED
        : OrderStatus.PARTIAL;

    await manager.save(Order, [buyOrder, sellOrder]);

    await manager.save(
      manager.create(Trade, {
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        price: px,
        quantity: mq,
        tradeValue,
      }),
    );

    const limitBuy = Number(buyOrder.price ?? 0);
    if (buyOrder.side !== OrderSide.BUY || sellOrder.side !== OrderSide.SELL) {
      throw new Error('Chiều lệnh khớp không hợp lệ');
    }

    const buyerWallet = await manager.findOne(Wallet, {
      where: { tradingAccountId: buyOrder.tradingAccountId },
      lock: { mode: 'pessimistic_write' },
    });
    const sellerWallet = await manager.findOne(Wallet, {
      where: { tradingAccountId: sellOrder.tradingAccountId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!buyerWallet || !sellerWallet) {
      throw new Error('Không tìm thấy ví');
    }

    buyerWallet.lockedBalance =
      Number(buyerWallet.lockedBalance) - limitBuy * mq;
    buyerWallet.availableBalance =
      Number(buyerWallet.availableBalance) + (limitBuy - px) * mq;
    await manager.save(Wallet, buyerWallet);

    sellerWallet.availableBalance =
      Number(sellerWallet.availableBalance) + tradeValue;
    await manager.save(Wallet, sellerWallet);

    await manager.save(
      manager.create(CashTransaction, {
        walletId: buyerWallet.id,
        type: TransactionType.BUY_MATCHED,
        amount: -tradeValue,
        balanceAfter:
          Number(buyerWallet.availableBalance) +
          Number(buyerWallet.lockedBalance),
        refOrderId: buyOrder.id,
        description: `Khớp mua ${mq} @ ${px}`,
      }),
    );
    await manager.save(
      manager.create(CashTransaction, {
        walletId: sellerWallet.id,
        type: TransactionType.SELL_MATCHED,
        amount: tradeValue,
        balanceAfter:
          Number(sellerWallet.availableBalance) +
          Number(sellerWallet.lockedBalance),
        refOrderId: sellOrder.id,
        description: `Khớp bán ${mq} @ ${px}`,
      }),
    );

    const buyerPos = await manager.findOne(Position, {
      where: {
        tradingAccountId: buyOrder.tradingAccountId,
        stockId: buyOrder.stockId,
      },
      lock: { mode: 'pessimistic_write' },
    });
    const sellerPos = await manager.findOne(Position, {
      where: {
        tradingAccountId: sellOrder.tradingAccountId,
        stockId: sellOrder.stockId,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!sellerPos) {
      throw new Error('Không có position bên bán');
    }

    // quantity đã trừ lúc đặt lệnh bán; khớp chỉ giảm phần phong tỏa
    sellerPos.lockedQuantity = Math.max(
      0,
      Number(sellerPos.lockedQuantity) - mq,
    );
    await manager.save(Position, sellerPos);

    const oldQty = buyerPos ? Number(buyerPos.quantity) : 0;
    const oldAvg = buyerPos ? Number(buyerPos.avgPrice) : 0;
    const newQty = oldQty + mq;
    const newAvg =
      newQty > 0
        ? oldQty <= 0
          ? px
          : (oldQty * oldAvg + mq * px) / newQty
        : 0;

    if (buyerPos) {
      buyerPos.quantity = newQty;
      buyerPos.avgPrice = newAvg;
      await manager.save(Position, buyerPos);
    } else {
      await manager.save(
        manager.create(Position, {
          tradingAccountId: buyOrder.tradingAccountId,
          stockId: buyOrder.stockId,
          quantity: mq,
          lockedQuantity: 0,
          avgPrice: px,
        }),
      );
    }

    await this.pushOrderNotify(manager, buyOrder, notifies, seenOrderIds);
    await this.pushOrderNotify(manager, sellOrder, notifies, seenOrderIds);

    return px;
  }

  private async pushOrderNotify(
    manager: EntityManager,
    order: Order,
    notifies: OrderFillNotify[],
    seenOrderIds: Set<string>,
  ): Promise<void> {
    if (seenOrderIds.has(order.id)) return;
    seenOrderIds.add(order.id);

    const account = await manager.findOne(TradingAccount, {
      where: { id: order.tradingAccountId },
    });
    if (!account) return;

    notifies.push({
      orderId: order.id,
      userId: account.userId,
      status: order.status,
      matchedQty: Number(order.matchedQty),
      quantity: Number(order.quantity),
      side: order.side,
    });
  }
}
