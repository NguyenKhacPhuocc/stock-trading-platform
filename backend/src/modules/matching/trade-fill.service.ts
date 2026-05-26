import { Injectable, Logger } from '@nestjs/common';
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
import { orderRef } from './util/order-flow-log.util';
import { walletLedgerSnapshot } from '../../common/utils/wallet-ledger-snapshot.util';
import { StockLedgerType } from '../../common/const/stock-ledger';
import { recordPositionLedger } from '../../common/utils/record-position-ledger.util';

/** Ghi khớp lệnh: orders, trades, ví, position. */
@Injectable()
export class TradeFillService {
  private readonly logger = new Logger(TradeFillService.name);

  constructor(private readonly dataSource: DataSource) {}

  async applyFills(
    fills: TradeFillPlan[],
    symbol?: string,
  ): Promise<{ lastTradePrice: number | null; notifies: OrderFillNotify[] }> {
    if (fills.length === 0) return { lastTradePrice: null, notifies: [] };

    let lastPx: number | null = null;
    const notifies: OrderFillNotify[] = [];
    const seenOrderIds = new Set<string>();
    await this.dataSource.transaction(async (manager) => {
      for (const fill of fills) {
        lastPx = await this.applyOneFill(
          manager,
          fill,
          notifies,
          seenOrderIds,
          symbol,
        );
      }
    });
    return { lastTradePrice: lastPx, notifies };
  }

  private async applyOneFill(
    manager: EntityManager,
    fill: TradeFillPlan,
    notifies: OrderFillNotify[],
    seenOrderIds: Set<string>,
    symbol?: string,
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

    this.logger.log(
      `[order-flow] order status DB | buy ${orderRef(buyOrder.id, buyOrder.orderCode)} → ${buyOrder.status} matched=${buyOrder.matchedQty}/${buyOrder.quantity}${symbol ? ` ${symbol}` : ''}`,
    );
    this.logger.log(
      `[order-flow] order status DB | sell ${orderRef(sellOrder.id, sellOrder.orderCode)} → ${sellOrder.status} matched=${sellOrder.matchedQty}/${sellOrder.quantity}`,
    );

    const sellerPosForCost = await manager.findOne(Position, {
      where: {
        tradingAccountId: sellOrder.tradingAccountId,
        stockId: sellOrder.stockId,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!sellerPosForCost) {
      throw new Error('Không có position bên bán');
    }
    const costBasisPrice = Number(sellerPosForCost.avgPrice);
    const realizedPnL = (px - costBasisPrice) * mq;

    const tradeRow = await manager.save(
      manager.create(Trade, {
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        price: px,
        quantity: mq,
        tradeValue,
        stockId: buyOrder.stockId,
        costBasisPrice,
        realizedPnL,
      }),
    );
    this.logger.log(
      `[order-flow] DB save | table=trades id=${tradeRow.id} buyOrder=${orderRef(buyOrder.id, buyOrder.orderCode)} sellOrder=${orderRef(sellOrder.id, sellOrder.orderCode)} price=${px} qty=${mq} tradeValue=${tradeValue}${symbol ? ` ${symbol}` : ''}`,
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
    this.logger.log(
      `[order-flow] DB save | table=wallets id=${buyerWallet.id} role=buyer avail=${buyerWallet.availableBalance} locked=${buyerWallet.lockedBalance}`,
    );

    sellerWallet.availableBalance =
      Number(sellerWallet.availableBalance) + tradeValue;
    await manager.save(Wallet, sellerWallet);
    this.logger.log(
      `[order-flow] DB save | table=wallets id=${sellerWallet.id} role=seller avail=${sellerWallet.availableBalance} locked=${sellerWallet.lockedBalance}`,
    );

    const buyCashTx = await manager.save(
      manager.create(CashTransaction, {
        walletId: buyerWallet.id,
        type: TransactionType.BUY_MATCHED,
        amount: -tradeValue,
        ...walletLedgerSnapshot(buyerWallet),
        refOrderId: buyOrder.id,
        description: `Khớp mua ${mq} @ ${px}`,
      }),
    );
    const sellCashTx = await manager.save(
      manager.create(CashTransaction, {
        walletId: sellerWallet.id,
        type: TransactionType.SELL_MATCHED,
        amount: tradeValue,
        ...walletLedgerSnapshot(sellerWallet),
        refOrderId: sellOrder.id,
        description: `Khớp bán ${mq} @ ${px}`,
      }),
    );
    this.logger.log(
      `[order-flow] DB save | table=cash_transactions buyerTx=${buyCashTx.id} amount=${buyCashTx.amount} sellerTx=${sellCashTx.id} amount=${sellCashTx.amount}`,
    );

    const buyerPos = await manager.findOne(Position, {
      where: {
        tradingAccountId: buyOrder.tradingAccountId,
        stockId: buyOrder.stockId,
      },
      lock: { mode: 'pessimistic_write' },
    });
    // quantity đã trừ lúc đặt lệnh bán; khớp chỉ giảm phần phong tỏa
    sellerPosForCost.lockedQuantity = Math.max(
      0,
      Number(sellerPosForCost.lockedQuantity) - mq,
    );
    await manager.save(Position, sellerPosForCost);
    this.logger.log(
      `[order-flow] DB save | table=positions id=${sellerPosForCost.id} role=seller qty=${sellerPosForCost.quantity} lockedQty=${sellerPosForCost.lockedQuantity}`,
    );
    await recordPositionLedger(manager, {
      tradingAccountId: sellOrder.tradingAccountId,
      stockId: sellOrder.stockId,
      type: StockLedgerType.SELL_MATCHED,
      quantityDelta: 0,
      lockedDelta: -mq,
      quantityAfter: Number(sellerPosForCost.quantity),
      lockedAfter: Number(sellerPosForCost.lockedQuantity),
      refOrderId: sellOrder.id,
      refTradeId: tradeRow.id,
      description: `Khớp bán ${mq} @ ${px}`,
    });

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
      this.logger.log(
        `[order-flow] DB save | table=positions id=${buyerPos.id} role=buyer qty=${buyerPos.quantity} avgPrice=${buyerPos.avgPrice}`,
      );
      await recordPositionLedger(manager, {
        tradingAccountId: buyOrder.tradingAccountId,
        stockId: buyOrder.stockId,
        type: StockLedgerType.BUY_MATCHED,
        quantityDelta: mq,
        lockedDelta: 0,
        quantityAfter: Number(buyerPos.quantity),
        lockedAfter: Number(buyerPos.lockedQuantity),
        refOrderId: buyOrder.id,
        refTradeId: tradeRow.id,
        description: `Khớp mua ${mq} @ ${px}`,
      });
    } else {
      const newPos = await manager.save(
        manager.create(Position, {
          tradingAccountId: buyOrder.tradingAccountId,
          stockId: buyOrder.stockId,
          quantity: mq,
          lockedQuantity: 0,
          avgPrice: px,
        }),
      );
      this.logger.log(
        `[order-flow] DB save | table=positions id=${newPos.id} role=buyer qty=${newPos.quantity} avgPrice=${newPos.avgPrice} (new)`,
      );
      await recordPositionLedger(manager, {
        tradingAccountId: buyOrder.tradingAccountId,
        stockId: buyOrder.stockId,
        type: StockLedgerType.BUY_MATCHED,
        quantityDelta: mq,
        lockedDelta: 0,
        quantityAfter: Number(newPos.quantity),
        lockedAfter: 0,
        refOrderId: buyOrder.id,
        refTradeId: tradeRow.id,
        description: `Khớp mua ${mq} @ ${px}`,
      });
    }

    const sym = (symbol ?? '').trim().toUpperCase();
    const fillCtx = { symbol: sym, fillPrice: px, fillQty: mq };
    await this.pushOrderNotify(manager, buyOrder, notifies, seenOrderIds, fillCtx);
    await this.pushOrderNotify(manager, sellOrder, notifies, seenOrderIds, fillCtx);

    return px;
  }

  private async pushOrderNotify(
    manager: EntityManager,
    order: Order,
    notifies: OrderFillNotify[],
    seenOrderIds: Set<string>,
    fillCtx: { symbol: string; fillPrice: number; fillQty: number },
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
      symbol: fillCtx.symbol,
      fillPrice: fillCtx.fillPrice,
      fillQty: fillCtx.fillQty,
    });
  }
}
