'use client';

import { useEffect, useState } from 'react';
import { OrderBookPanel } from '@/components/order/order-book-panel';
import { OrderChartPanel } from '@/components/order/order-chart-panel';
import { OrderEntryPanel } from '@/components/order/order-entry-panel';
import { OrderMainBottomPanel } from '@/components/order/order-main-bottom-panel';
import { OrderTradeHistoryPanel } from '@/components/order/order-trade-history-panel';
import type { BottomTab, OrderEntryTab, OrderSide, OrderType } from '@/components/order/order-types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchMarketRows } from '@/store/slices/market.slice';

export default function OrderPage() {
  const dispatch = useAppDispatch();
  const searchUniverse = useAppSelector((s) => s.market.searchUniverse);
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedAccount = tradingAccounts.find((a) => a.id === selectedTradingAccountId);

  const [symbol, setSymbol] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('LO');
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [triggerOperator, setTriggerOperator] = useState<'gte' | 'lte'>('gte');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [orderEntryTab, setOrderEntryTab] = useState<OrderEntryTab>('regular');
  const [bottomTab, setBottomTab] = useState<BottomTab>('orders');

  useEffect(() => {
    if (searchUniverse.length > 0) return;
    void dispatch(fetchMarketRows({ exchange: 'ALL' }));
  }, [dispatch, searchUniverse.length]);

  // Auto-select first symbol when available (derived value, no cascading updates)
  const effectiveSymbol = symbol || (searchUniverse.length > 0 ? searchUniverse[0].symbol : '');

  const accountIdLabel = selectedAccount?.accountId ?? '--';
  const isLo = orderType === 'LO';
  const baseValid = Boolean(effectiveSymbol) && Number(quantity) > 0 && (!isLo || Number(price) > 0);
  const canSubmit =
    orderEntryTab === 'regular' ? baseValid : baseValid && Number(triggerPrice) > 0;

  const panelCard = 'rounded-md border border-border bg-[#0b0d11]';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden bg-[#0b0d11] p-1">
      <div className="grid min-h-0 flex-[2] grid-cols-1 gap-1 xl:grid-cols-[2.35fr_0.85fr_1fr]">
        <OrderChartPanel panelCardClassName={panelCard} symbolLabel={effectiveSymbol} />
        <OrderBookPanel panelCardClassName={panelCard} />
        <OrderEntryPanel
          panelCardClassName={panelCard}
          orderEntryTab={orderEntryTab}
          onOrderEntryTabChange={setOrderEntryTab}
          accountIdLabel={accountIdLabel}
          symbol={symbol}
          symbolOptions={searchUniverse}
          onSymbolChange={setSymbol}
          orderSide={orderSide}
          onOrderSideChange={setOrderSide}
          quantity={quantity}
          onQuantityChange={setQuantity}
          orderType={orderType}
          onOrderTypeChange={setOrderType}
          price={price}
          onPriceChange={setPrice}
          isLo={isLo}
          triggerOperator={triggerOperator}
          onTriggerOperatorChange={setTriggerOperator}
          triggerPrice={triggerPrice}
          onTriggerPriceChange={setTriggerPrice}
          canSubmit={canSubmit}
        />
      </div>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-1 xl:grid-cols-[2.35fr_0.85fr_1fr]">
        <OrderMainBottomPanel
          panelCardClassName={panelCard}
          bottomTab={bottomTab}
          onBottomTabChange={setBottomTab}
        />
        <OrderTradeHistoryPanel panelCardClassName={panelCard} />
      </section>
    </div>
  );
}
