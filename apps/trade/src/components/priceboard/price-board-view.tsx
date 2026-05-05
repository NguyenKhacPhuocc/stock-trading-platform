'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchMarketRows } from '@/store/slices/market.slice';
import type { ExchangeCode } from './price-board-types';
import { PriceBoardOverview } from './price-board-overview';
import { PriceBoardTable, type PriceBoardTableHandle } from './price-board-table';
import { PriceBoardToolbar } from './price-board-toolbar';

export default function PriceBoardView() {
  const dispatch = useAppDispatch();
  const tableRef = useRef<PriceBoardTableHandle | null>(null);
  const pendingScrollSymbolRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const exchangeBySymbol = useAppSelector((s) => s.market.exchangeBySymbol);
  const orderSymbols = useAppSelector((s) => s.market.orderSymbols);
  const searchUniverse = useAppSelector((s) => s.market.searchUniverse);
  const [exchange, setExchange] = useState<ExchangeCode | 'ALL'>('HOSE');
  const [search, setSearch] = useState('');
  const [pinnedSymbols, setPinnedSymbols] = useState<string[]>([]);
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);
  const [nowLabel, setNowLabel] = useState('');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setNowLabel(
        `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    dispatch(fetchMarketRows({ exchange }));
  }, [dispatch, exchange]);

  const exchangeFilteredSymbols = useMemo(() => {
    if (exchange === 'ALL') return orderSymbols;
    return orderSymbols.filter((sym) => exchangeBySymbol[sym] === exchange);
  }, [exchange, orderSymbols, exchangeBySymbol]);

  const pinnedSet = useMemo(() => new Set(pinnedSymbols), [pinnedSymbols]);
  const exchangeFilteredSet = useMemo(() => new Set(exchangeFilteredSymbols), [exchangeFilteredSymbols]);

  const pinnedSymbolsForView = useMemo(() => pinnedSymbols.filter((sym) => exchangeFilteredSet.has(sym)), [
    pinnedSymbols,
    exchangeFilteredSet,
  ]);

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

  const togglePin = useCallback((symbol: string) => {
    setPinnedSymbols((prev) =>
      prev.includes(symbol) ? prev.filter((x) => x !== symbol) : [...prev, symbol],
    );
  }, []);
  const clearPinned = useCallback(() => setPinnedSymbols([]), []);

  const triggerHighlight = useCallback((symbol: string) => {
    setHighlightedSymbol(symbol);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedSymbol((current) => (current === symbol ? null : current));
    }, 5000);
  }, []);

  const handleSelectSuggestion = useCallback((symbol: string) => {
    const selected = searchUniverse.find((item) => item.symbol === symbol);
    const targetExchange = selected?.exchange;
    setSearch(symbol);
    if (selected && selected.exchange !== exchange) {
      setExchange(selected.exchange);
      pendingScrollSymbolRef.current = symbol;
      return;
    }
    triggerHighlight(symbol);
    if (!targetExchange || targetExchange === exchange) {
      tableRef.current?.scrollToSymbol(symbol);
      pendingScrollSymbolRef.current = null;
      return;
    }
    // TODO: khi có auth/favorite theo account, thêm symbol vào watchlist tại đây.
  }, [exchange, searchUniverse, triggerHighlight]);
  const handleSelectPinned = useCallback((symbol: string) => {
    handleSelectSuggestion(symbol);
  }, [handleSelectSuggestion]);

  useEffect(() => {
    const pendingSymbol = pendingScrollSymbolRef.current;
    if (!pendingSymbol) return;
    const existsInUnpinned = unpinnedSymbolsForView.includes(pendingSymbol);
    if (!existsInUnpinned) {
      // Nếu nằm trong pinned thì không scroll được (virtual list chỉ chứa unpinned).
      pendingScrollSymbolRef.current = null;
      triggerHighlight(pendingSymbol);
      return;
    }
    tableRef.current?.scrollToSymbol(pendingSymbol);
    pendingScrollSymbolRef.current = null;
    triggerHighlight(pendingSymbol);
  }, [unpinnedSymbolsForView, triggerHighlight]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden bg-board-chart"
    >
      <PriceBoardOverview />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-border/40 bg-board-bg">
        <PriceBoardToolbar
          search={search}
          onSearchChange={setSearch}
          searchSuggestions={searchSuggestions}
          onSelectSuggestion={handleSelectSuggestion}
          exchange={exchange}
          onExchangeChange={setExchange}
          pinnedSymbols={pinnedSymbols}
          onSelectPinned={handleSelectPinned}
          onClearPinned={clearPinned}
        />
        <PriceBoardTable
          ref={tableRef}
          pinnedSymbols={pinnedSymbolsForView}
          unpinnedSymbols={unpinnedSymbolsForView}
          highlightedSymbol={highlightedSymbol}
          onTogglePin={togglePin}
        />
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-board-bg px-2 py-1 text-[11px] text-muted">
          <span>{nowLabel}</span>
          <span>Đơn vị: Giá x1000 · Khối lượng x10 · Dữ liệu mock</span>
        </footer>
      </div>
    </div>
  );
}
