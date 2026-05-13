'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { OrderBookPanel } from '@/components/order/order-book-panel';
import { OrderChartPanel } from '@/components/order/order-chart-panel';
import { OrderEntryPanel } from '@/components/order/order-entry-panel';
import { OrderMainBottomPanel } from '@/components/order/order-main-bottom-panel';
import { OrderTradeHistoryPanel } from '@/components/order/order-trade-history-panel';
import type { BottomTab, OrderEntryTab, OrderSide, OrderType } from '@/components/order/order-types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { GATEWAY_ORDERS } from '@/lib/gateway-paths';
import { clearUser } from '@/store/slices/auth.slice';
import { useOrderBookRealtime } from '@/hooks/use-order-book-realtime';

const ORDER_SYMBOL_STORAGE_KEY = 'trade.order.symbol';

type OrderRow = {
  id: string;
  orderCode: string;
  side: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  matchedQty: number;
  price: number | null;
  orderType: string;
  status: string;
  accountId: string;
};

function mapOrderListItem(item: Record<string, unknown>): OrderRow {
  const ta = item.tradingAccount as { accountId?: string } | null | undefined;
  const accountId =
    typeof ta?.accountId === 'string' && ta.accountId.length > 0 ? ta.accountId : '--';
  return {
    id: String(item.id ?? ''),
    orderCode: String(item.orderCode ?? ''),
    side: (item.side === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell',
    symbol: String(
      (item.stock as { symbol?: string } | null | undefined)?.symbol ?? '',
    ),
    quantity: Number(item.quantity ?? 0),
    matchedQty: Number(item.matchedQty ?? 0),
    price: item.price == null ? null : Number(item.price),
    orderType: String(item.orderType ?? ''),
    status: String(item.status ?? ''),
    accountId,
  };
}

export default function OrderPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const searchUniverse = useAppSelector((s) => s.market.searchUniverse);
  const marketEntities = useAppSelector((s) => s.market.entities);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isHydratingSession = useAppSelector((s) => s.auth.isHydratingSession);
  const selectedTradingAccountId = useAppSelector((s) => s.auth.selectedTradingAccountId);
  const tradingAccounts = useAppSelector((s) => s.auth.tradingAccounts);
  const selectedAccount = tradingAccounts.find((a) => a.id === selectedTradingAccountId);
  const accountIdLabel = selectedAccount?.accountId ?? '--';

  const [symbol, setSymbol] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('LO');
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [triggerOperator, setTriggerOperator] = useState<'gte' | 'lte'>('gte');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [orderEntryTab, setOrderEntryTab] = useState<OrderEntryTab>('regular');
  const [bottomTab, setBottomTab] = useState<BottomTab>('orders');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  /** Chưa gán mã từ session / mặc định — tránh WS `subscribe:i` mã đầu danh sách rồi mới đổi. */
  const [orderSymbolBootstrapped, setOrderSymbolBootstrapped] = useState(false);
  const redirectedUnauthRef = useRef(false);

  const handleSessionExpired = useCallback(() => {
    dispatch(clearUser());
    toast.error('Phiên đăng nhập đã hết hạn');
    router.replace('/priceboard');
  }, [dispatch, router]);

  useEffect(() => {
    if (!isHydratingSession && !isAuthenticated && !redirectedUnauthRef.current) {
      redirectedUnauthRef.current = true;
      toast.info('Vui lòng đăng nhập để truy cập trang đặt lệnh');
      router.replace('/priceboard');
    }
  }, [isHydratingSession, isAuthenticated, router]);

  useEffect(() => {
    if (isHydratingSession || !isAuthenticated) {
      setOrders([]);
      setIsLoadingOrders(false);
      return;
    }
    let cancelled = false;
    const loadOrders = async () => {
      setIsLoadingOrders(true);
      try {
        const res = await fetch(GATEWAY_ORDERS.list, {
          credentials: 'same-origin',
        });
        if (res.status === 401) {
          if (!cancelled) handleSessionExpired();
          return;
        }
        const json = await res.json();
        if (!res.ok || json?.s !== 'ok') {
          throw new Error(json?.em || 'Không tải được danh sách lệnh');
        }
        const items = Array.isArray(json?.d) ? json.d : [];
        if (cancelled) return;
        const mapped = items.map((item: Record<string, unknown>) =>
          mapOrderListItem(item),
        );
        setOrders(mapped);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : 'Không tải được danh sách lệnh';
        toast.error(message);
      } finally {
        if (!cancelled) setIsLoadingOrders(false);
      }
    };
    void loadOrders();
    return () => {
      cancelled = true;
    };
  }, [handleSessionExpired, isAuthenticated, isHydratingSession]);

  useEffect(() => {
    if (searchUniverse.length === 0 || orderSymbolBootstrapped) return;
    try {
      const saved = sessionStorage
        .getItem(ORDER_SYMBOL_STORAGE_KEY)
        ?.trim()
        .toUpperCase();
      if (saved && searchUniverse.some((s) => s.symbol === saved)) {
        setSymbol(saved);
      } else {
        setSymbol(searchUniverse[0].symbol);
      }
    } catch {
      setSymbol(searchUniverse[0].symbol);
    }
    setOrderSymbolBootstrapped(true);
  }, [searchUniverse, orderSymbolBootstrapped]);

  useEffect(() => {
    if (!symbol) return;
    try {
      sessionStorage.setItem(ORDER_SYMBOL_STORAGE_KEY, symbol);
    } catch {
      /* noop */
    }
  }, [symbol]);

  const effectiveSymbol = orderSymbolBootstrapped
    ? symbol || (searchUniverse.length > 0 ? searchUniverse[0].symbol : '')
    : '';
  const liveOrderBook = useOrderBookRealtime(effectiveSymbol);
  const isLo = orderType === 'LO';
  const baseValid = Boolean(effectiveSymbol) && Number(quantity) > 0 && (!isLo || Number(price) > 0);
  const canSubmit =
    orderEntryTab === 'regular' ? baseValid : baseValid && Number(triggerPrice) > 0;

  const reloadOrders = async () => {
    if (isHydratingSession || !isAuthenticated) return;
    setIsLoadingOrders(true);
    try {
      const res = await fetch(GATEWAY_ORDERS.list, {
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const json = await res.json();
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không tải được danh sách lệnh');
      }
      const items = Array.isArray(json?.d) ? json.d : [];
      const mapped = items.map((item: Record<string, unknown>) =>
        mapOrderListItem(item),
      );
      setOrders(mapped);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không tải được danh sách lệnh';
      toast.error(message);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (!canSubmit || isSubmittingOrder) return;
    if (isHydratingSession || !isAuthenticated) {
      toast.error('Phiên đăng nhập chưa sẵn sàng, vui lòng thử lại');
      return;
    }
    setIsSubmittingOrder(true);
    try {
      const symKey = effectiveSymbol.trim().toUpperCase();
      const fromQuotes = searchUniverse.find((u) => u.symbol === symKey);
      const stockId = fromQuotes?.stockId ?? marketEntities[symKey]?.id;
      if (!stockId) throw new Error('Không tìm thấy mã chứng khoán');

      const clientOrderId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const payload = {
        clientOrderId,
        stockId,
        side: orderSide,
        orderType,
        quantity: Number(quantity),
        ...(isLo ? { price: Number(price) } : {}),
      };
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const res = await fetch(GATEWAY_ORDERS.place, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const json = await res.json();
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Đặt lệnh thất bại');
      }
      setQuantity('');
      setPrice('');
      await reloadOrders();
      toast.success('Đặt lệnh thành công');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đặt lệnh thất bại';
      toast.error(message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleCancelOrder = async (id: string) => {
    if (isHydratingSession || !isAuthenticated) {
      toast.error('Phiên đăng nhập chưa sẵn sàng, vui lòng thử lại');
      return;
    }
    setCancellingOrderId(id);
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const res = await fetch(GATEWAY_ORDERS.cancel(id), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const json = await res.json();
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Hủy lệnh thất bại');
      }
      await reloadOrders();
      toast.success('Hủy lệnh thành công');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hủy lệnh thất bại';
      toast.error(message);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const panelCard = 'rounded-md border border-border bg-[#0b0d11]';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden bg-[#0b0d11] p-1">
      <div className="grid min-h-0 flex-[2] grid-cols-1 gap-1 xl:grid-cols-[2.35fr_0.85fr_1fr]">
        <OrderChartPanel panelCardClassName={panelCard} symbolLabel={effectiveSymbol} />
        <OrderBookPanel
          panelCardClassName={panelCard}
          asks={liveOrderBook?.asks}
          bids={liveOrderBook?.bids}
          lastPrice={liveOrderBook?.lastPrice ?? undefined}
          lastDirection={liveOrderBook?.lastDirection}
        />
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
          isSubmitting={isSubmittingOrder}
          onSubmitOrder={handleSubmitOrder}
        />
      </div>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-1 xl:grid-cols-[2.35fr_0.85fr_1fr]">
        <OrderMainBottomPanel
          panelCardClassName={panelCard}
          bottomTab={bottomTab}
          onBottomTabChange={setBottomTab}
          orders={orders}
          isLoadingOrders={isLoadingOrders}
          onCancelOrder={handleCancelOrder}
          cancellingOrderId={cancellingOrderId}
        />
        <OrderTradeHistoryPanel panelCardClassName={panelCard} />
      </section>
    </div>
  );
}
