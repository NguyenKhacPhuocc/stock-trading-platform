'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { OrderBookPanel } from '@/components/order/order-book-panel';
import { OrderChartPanel } from '@/components/order/order-chart-panel';
import { OrderConfirmDialog } from '@/components/order/order-confirm-dialog';
import { OrderEntryPanel } from '@/components/order/order-entry-panel';
import { OrderMainBottomPanel } from '@/components/order/order-main-bottom-panel';
import { OrderTradeHistoryPanel } from '@/components/order/order-trade-history-panel';
import type {
  BottomTab,
  OrderEntryTab,
  OrderPreCheckIntent,
  OrderSide,
  OrderType,
} from '@/components/order/order-types';
import {
  formatOrderStatusLabel,
  isValidLotQuantity,
  parseOrderQuantityInput,
} from '@/components/order/order-types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { GATEWAY_ORDERS, GATEWAY_WALLET } from '@/lib/gateway-paths';
import { clearUser } from '@/store/slices/auth.slice';
import { useOrderBookRealtime } from '@/hooks/use-order-book-realtime';
import { useTradeRealtimeSocket } from '@/components/trade-realtime-provider';
import { WS_SERVER_EVT } from '@/lib/ws-realtime.constants';

const ORDER_SYMBOL_STORAGE_KEY = 'trade.order.symbol';

type OrderRow = {
  id: string;
  orderCode: string;
  side: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  matchedQty: number;
  avgMatchedPrice: number | null;
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
    avgMatchedPrice:
      item.avgMatchedPrice == null ? null : Number(item.avgMatchedPrice),
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
  const authUserId = useAppSelector((s) => s.auth.user?.id);
  const socket = useTradeRealtimeSocket();
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
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [sellableBySymbol, setSellableBySymbol] = useState<Record<string, number>>(
    {},
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState<OrderPreCheckIntent | null>(
    null,
  );
  const [isPreChecking, setIsPreChecking] = useState(false);
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

  const reloadOrders = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (isHydratingSession || !isAuthenticated) return;
      if (!opts?.silent) setIsLoadingOrders(true);
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
        if (!opts?.silent) toast.error(message);
      } finally {
        if (!opts?.silent) setIsLoadingOrders(false);
      }
    },
    [handleSessionExpired, isAuthenticated, isHydratingSession],
  );

  const reloadOrdersRef = useRef(reloadOrders);
  reloadOrdersRef.current = reloadOrders;

  const reloadPortfolio = useCallback(async () => {
    if (isHydratingSession || !isAuthenticated) return;
    try {
      const res = await fetch(GATEWAY_WALLET.portfolio, {
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const json = await res.json();
      if (!res.ok || json?.s !== 'ok') return;
      const d = json.d as
        | {
            availableBalance?: unknown;
            positions?: Array<{ symbol?: unknown; quantity?: unknown }>;
          }
        | null
        | undefined;
      const avail = Number(d?.availableBalance);
      setAvailableBalance(Number.isFinite(avail) ? avail : null);
      const map: Record<string, number> = {};
      for (const row of d?.positions ?? []) {
        const sym =
          typeof row?.symbol === 'string' ? row.symbol.trim().toUpperCase() : '';
        if (!sym) continue;
        const qty = Number(row.quantity);
        map[sym] = Number.isFinite(qty) && qty > 0 ? qty : 0;
      }
      setSellableBySymbol(map);
    } catch {
      /* sức mua/bán phụ — không chặn đặt lệnh */
    }
  }, [handleSessionExpired, isAuthenticated, isHydratingSession]);

  const reloadPortfolioRef = useRef(reloadPortfolio);
  reloadPortfolioRef.current = reloadPortfolio;

  useEffect(() => {
    if (isHydratingSession || !isAuthenticated) {
      setOrders([]);
      setIsLoadingOrders(false);
      setAvailableBalance(null);
      setSellableBySymbol({});
      return;
    }
    void reloadOrders();
    void reloadPortfolio();
  }, [isHydratingSession, isAuthenticated, reloadOrders, reloadPortfolio]);

  useEffect(() => {
    if (!socket || !authUserId || !isAuthenticated) return;

    const subscribeMe = () => {
      socket.emit('subscribe:me', { userId: authUserId });
    };
    const onOrderMatched = (payload: unknown) => {
      void reloadOrdersRef.current({ silent: true });
      void reloadPortfolioRef.current();
      if (payload && typeof payload === 'object') {
        const p = payload as {
          side?: string;
          matchedQty?: number;
          quantity?: number;
          status?: string;
        };
        const sideLabel = p.side === 'sell' ? 'Bán' : 'Mua';
        const matched = Number(p.matchedQty ?? 0);
        const total = Number(p.quantity ?? 0);
        const statusLabel = formatOrderStatusLabel(String(p.status ?? ''));
        toast.success(
          `Lệnh ${sideLabel}: khớp ${matched.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')} — ${statusLabel}`,
        );
      }
    };

    socket.on('connect', subscribeMe);
    socket.on(WS_SERVER_EVT.ORDER_MATCHED, onOrderMatched);
    if (socket.connected) subscribeMe();

    return () => {
      socket.off('connect', subscribeMe);
      socket.off(WS_SERVER_EVT.ORDER_MATCHED, onOrderMatched);
      socket.emit('unsubscribe:me', { userId: authUserId });
    };
  }, [socket, authUserId, isAuthenticated]);

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
  const sellableQuantity = effectiveSymbol
    ? (sellableBySymbol[effectiveSymbol.trim().toUpperCase()] ?? 0)
    : null;
  const liveOrderBook = useOrderBookRealtime(effectiveSymbol);
  const isLo = orderType === 'LO';
  const isMak = orderType === 'MAK';
  const qtyNum = parseOrderQuantityInput(quantity);
  const quantityInvalid = quantity.trim().length > 0 && !isValidLotQuantity(qtyNum);
  const symKeyForRow = effectiveSymbol.trim().toUpperCase();
  const boardRow = symKeyForRow ? marketEntities[symKeyForRow] : undefined;
  const unitPriceForEstimate = isLo
    ? Number(price)
    : orderSide === 'buy'
      ? Number(boardRow?.ceil ?? 0)
      : Number(boardRow?.floor ?? 0);
  const estimatedTotal =
    qtyNum > 0 && unitPriceForEstimate > 0 ? qtyNum * unitPriceForEstimate : null;
  const baseValid =
    Boolean(effectiveSymbol) &&
    isValidLotQuantity(qtyNum) &&
    (isMak || (isLo && Number(price) > 0));
  const canSubmit = orderEntryTab === 'regular' && baseValid;

  const handleOpenConfirm = async () => {
    if (!canSubmit || isSubmittingOrder || isPreChecking) return;
    if (isHydratingSession || !isAuthenticated) {
      toast.error('Phiên đăng nhập chưa sẵn sàng, vui lòng thử lại');
      return;
    }
    const symKey = effectiveSymbol.trim().toUpperCase();
    const fromQuotes = searchUniverse.find((u) => u.symbol === symKey);
    const stockId = fromQuotes?.stockId ?? marketEntities[symKey]?.id;
    if (!stockId) {
      toast.error('Không tìm thấy mã chứng khoán');
      return;
    }

    setIsPreChecking(true);
    try {
      const res = await fetch(GATEWAY_ORDERS.preCheck, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockId,
          side: orderSide,
          orderType,
          quantity: qtyNum,
          ...(isLo ? { price: Number(price) } : {}),
        }),
      });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const json = await res.json();
      if (!res.ok || json?.s !== 'ok') {
        throw new Error(json?.em || 'Không kiểm tra được lệnh');
      }
      const intent = json.d as OrderPreCheckIntent;
      if (
        !intent?.requestId ||
        !intent?.transactionId ||
        !intent?.tokenId
      ) {
        throw new Error('Phản hồi kiểm tra lệnh không hợp lệ');
      }
      setConfirmIntent(intent);
      setConfirmOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không kiểm tra được lệnh';
      toast.error(message);
    } finally {
      setIsPreChecking(false);
    }
  };

  const handleSubmitOrder = async (pin: string) => {
    if (!canSubmit || isSubmittingOrder) return;
    if (!confirmIntent) {
      toast.error('Vui lòng xác nhận lệnh qua bước kiểm tra trước');
      return;
    }
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
        quantity: qtyNum,
        ...(isLo ? { price: Number(price) } : {}),
        requestId: confirmIntent.requestId,
        transactionId: confirmIntent.transactionId,
        tokenId: confirmIntent.tokenId,
        pin,
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
      setConfirmOpen(false);
      setConfirmIntent(null);
      void reloadOrders({ silent: true });
      void reloadPortfolio();
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
      void reloadOrders({ silent: true });
      void reloadPortfolio();
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
          isMak={isMak}
          triggerOperator={triggerOperator}
          onTriggerOperatorChange={setTriggerOperator}
          triggerPrice={triggerPrice}
          onTriggerPriceChange={setTriggerPrice}
          canSubmit={canSubmit}
          quantityInvalid={quantityInvalid}
          availableBalance={orderSide === 'buy' ? availableBalance : null}
          sellableQuantity={orderSide === 'sell' ? sellableQuantity : null}
          estimatedTotal={estimatedTotal}
          isPreChecking={isPreChecking}
          isSubmitting={isSubmittingOrder}
          onOpenConfirm={() => void handleOpenConfirm()}
        />
      </div>

      <OrderConfirmDialog
        open={confirmOpen}
        display={{
          symbol: effectiveSymbol,
          side: orderSide,
          orderType,
          quantity: qtyNum,
          orderPrice: isLo ? Number(price) : unitPriceForEstimate,
          estimatedTotal,
        }}
        isSubmitting={isSubmittingOrder}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmIntent(null);
        }}
        onConfirm={(pin) => void handleSubmitOrder(pin)}
      />

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
        <OrderTradeHistoryPanel
          panelCardClassName={panelCard}
          stockId={
            (() => {
              const symKey = effectiveSymbol.trim().toUpperCase();
              const fromQuotes = searchUniverse.find((u) => u.symbol === symKey);
              return fromQuotes?.stockId ?? marketEntities[symKey]?.id ?? '';
            })()
          }
          symbol={effectiveSymbol}
        />
      </section>
    </div>
  );
}
