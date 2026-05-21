'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useTradeRealtimeSocket } from '@/components/trade-realtime-provider';
import { PriceBoardTable } from '@/components/priceboard/price-board-table';
import { PriceBoardToolbar } from '@/components/priceboard/price-board-toolbar';
import type { ExchangeCode } from '@/components/priceboard/price-board-types';
import { fetchMarketRows } from '@/store/slices/market.slice';
import {
  WS_EXCHANGE_CODES,
  diffSubscribeRooms,
  sortDedupeStrings,
} from '@/lib/ws-realtime.constants';

type OrderChartPanelProps = {
  panelCardClassName: string;
  symbolLabel: string;
};

export function OrderChartPanel({ panelCardClassName, symbolLabel }: OrderChartPanelProps) {
  const [tab, setTab] = useState<'chart' | 'board'>('chart');
  const boardExchangeRoomsRef = useRef<string[] | null>(null);
  const chartBoardWsResyncAfterDisconnectRef = useRef(false);
  const socket = useTradeRealtimeSocket();
  const dispatch = useAppDispatch();
  const exchangeBySymbol = useAppSelector((s) => s.market.exchangeBySymbol);
  const orderSymbols = useAppSelector((s) => s.market.orderSymbols);
  const searchUniverse = useAppSelector((s) => s.market.searchUniverse);

  const [exchange, setExchange] = useState<ExchangeCode | 'ALL'>('HOSE');
  const [search, setSearch] = useState('');
  const [pinnedSymbols, setPinnedSymbols] = useState<string[]>([]);

  useEffect(() => {
    if (tab !== 'board') return;
    void dispatch(fetchMarketRows({ exchange }));
  }, [dispatch, exchange, tab]);

  useEffect(() => {
    if (!socket || tab !== 'board') return;

    const exSorted = sortDedupeStrings(
      exchange === 'ALL' ? [...WS_EXCHANGE_CODES] : [exchange as (typeof WS_EXCHANGE_CODES)[number]],
    );

    const applyBoardExchangeRooms = () => {
      const prev = boardExchangeRoomsRef.current;
      if (prev === null) {
        socket.emit('subscribe:e', { EX: exSorted });
        boardExchangeRoomsRef.current = exSorted;
      } else {
        const { leave, join } = diffSubscribeRooms(prev, exSorted);
        if (leave.length > 0) socket.emit('unsubscribe:e', { EX: leave });
        if (join.length > 0) socket.emit('subscribe:e', { EX: join });
        boardExchangeRoomsRef.current = exSorted;
      }
    };

    const onDisconnect = () => {
      chartBoardWsResyncAfterDisconnectRef.current = true;
      boardExchangeRoomsRef.current = null;
    };

    const onConnect = () => {
      if (!chartBoardWsResyncAfterDisconnectRef.current) return;
      chartBoardWsResyncAfterDisconnectRef.current = false;
      boardExchangeRoomsRef.current = null;
      socket.emit('subscribe:e', { EX: exSorted });
      boardExchangeRoomsRef.current = exSorted;
    };

    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    applyBoardExchangeRooms();

    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
      const last = boardExchangeRoomsRef.current;
      if (last !== null && last.length > 0) socket.emit('unsubscribe:e', { EX: last });
      boardExchangeRoomsRef.current = null;
    };
  }, [socket, tab, exchange]);

  const exchangeFilteredSymbols = useMemo(() => {
    if (exchange === 'ALL') return orderSymbols;
    return orderSymbols.filter((sym) => exchangeBySymbol[sym] === exchange);
  }, [exchange, orderSymbols, exchangeBySymbol]);

  const pinnedSet = useMemo(() => new Set(pinnedSymbols), [pinnedSymbols]);
  const exchangeFilteredSet = useMemo(() => new Set(exchangeFilteredSymbols), [exchangeFilteredSymbols]);

  const pinnedSymbolsForView = useMemo(
    () => pinnedSymbols.filter((sym) => exchangeFilteredSet.has(sym)),
    [pinnedSymbols, exchangeFilteredSet],
  );

  const unpinnedSymbolsForView = useMemo(
    () => exchangeFilteredSymbols.filter((sym) => !pinnedSet.has(sym)),
    [exchangeFilteredSymbols, pinnedSet],
  );

  const searchSuggestions = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return [];
    const sortSuggestions = [...searchUniverse]
      .filter((item) => item.symbol.includes(q))
      .sort((a, b) => {
        const aSym = a.symbol;
        const bSym = b.symbol;
        if (aSym === q) return -1;
        if (bSym === q) return 1;
        const aStarts = aSym.startsWith(q);
        const bStarts = bSym.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        if (aSym.length !== bSym.length) return aSym.length - bSym.length;
        return aSym.localeCompare(bSym);
      });
    return sortSuggestions.slice(0, 12);
  }, [searchUniverse, search]);

  const togglePin = (symbol: string) => {
    setPinnedSymbols((prev) => (prev.includes(symbol) ? prev.filter((x) => x !== symbol) : [...prev, symbol]));
  };
  const clearPinned = () => setPinnedSymbols([]);

  const handleSelectSuggestion = (symbol: string) => {
    setSearch(symbol);
    // Mini-board tạm thời không auto-scroll / highlight; chỉ cập nhật ô tìm kiếm.
  };

  const tabBtn =
    'rounded px-2 py-1 text-[11px] font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-border';
  const tabActive = 'bg-surface-2 text-foreground ring-1 ring-border/80';
  const tabIdle = 'text-muted hover:bg-white/[0.04] hover:text-foreground';

  return (
    <section className={`${panelCardClassName} min-h-[260px] overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`${tabBtn} ${tab === 'chart' ? tabActive : tabIdle}`}
            onClick={() => setTab('chart')}
          >
            Đồ thị
          </button>
          <button
            type="button"
            className={`${tabBtn} ${tab === 'board' ? tabActive : tabIdle}`}
            onClick={() => setTab('board')}
          >
            Bảng giá
          </button>
        </div>
        <div className="text-[12px] text-muted font-semibold bg-primary-dark px-2 py-[2px]  rounded text-white">{symbolLabel || '---'}</div>
      </div>
      {tab === 'chart' ? (
        <div className="flex h-[calc(100%-37px)] items-center justify-center bg-black text-xs text-muted">
          Chart panel (sẽ nối chart thật ở bước tiếp theo)
        </div>
      ) : (
        <div className="flex h-[calc(100%-37px)] flex-col overflow-hidden bg-board-bg">
          <PriceBoardToolbar
            search={search}
            onSearchChange={setSearch}
            searchSuggestions={searchSuggestions}
            onSelectSuggestion={handleSelectSuggestion}
            exchange={exchange}
            onExchangeChange={setExchange}
            pinnedSymbols={pinnedSymbols}
            onSelectPinned={handleSelectSuggestion}
            onClearPinned={clearPinned}
          />
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full min-w-[1180px]">
              <PriceBoardTable
                pinnedSymbols={pinnedSymbolsForView}
                unpinnedSymbols={unpinnedSymbolsForView}
                highlightedSymbol={null}
                onTogglePin={togglePin}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
