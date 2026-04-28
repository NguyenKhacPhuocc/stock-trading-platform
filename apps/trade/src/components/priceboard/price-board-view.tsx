'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@stock/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchMarketRows } from '@/store/slices/market.slice';
import type { ExchangeCode, PriceBoardRow } from './price-board-types';
import { PriceBoardOverview } from './price-board-overview';
import { PriceBoardTable, type PriceBoardTableHandle } from './price-board-table';
import { PriceBoardToolbar } from './price-board-toolbar';

export default function PriceBoardView() {
  const dispatch = useAppDispatch();
  const tableRef = useRef<PriceBoardTableHandle | null>(null);
  const pendingScrollSymbolRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const rows = useAppSelector((s) => s.market.rows);
  const [exchange, setExchange] = useState<ExchangeCode | 'ALL'>('HOSE');
  const [search, setSearch] = useState('');
  const [pinnedSymbols, setPinnedSymbols] = useState<string[]>([]);
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);
  const [searchUniverse, setSearchUniverse] = useState<
    Array<{ symbol: string; exchange: ExchangeCode; fullName?: string }>
  >([]);
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

  useEffect(() => {
    const loadQuotes = async () => {
      try {
        const res = await apiClient.get('/market/quotes', { params: { symbols: 'ALL' } });
        const payload = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.d)
            ? res.data.d
            : [];
        const normalized = (payload as Array<Record<string, unknown>>)
          .map((item) => ({
            symbol: String(item.symbol ?? '').toUpperCase(),
            exchange: String(item.exchange ?? '').toUpperCase() as ExchangeCode,
            fullName: typeof item.fullName === 'string' ? item.fullName : undefined,
          }))
          .filter((item) => item.symbol && item.exchange)
          .sort((a, b) => a.symbol.localeCompare(b.symbol));
        setSearchUniverse(normalized);
      } catch {
        setSearchUniverse([]);
      }
    };
    void loadQuotes();
  }, []);

  const displayRows = useMemo(() => {
    let list = rows;
    if (exchange !== 'ALL') list = list.filter((r) => r.exchange === exchange);
    const pinnedSet = new Set(pinnedSymbols);
    const pinned = pinnedSymbols.map((symbol) => list.find((r) => r.symbol === symbol)).filter(Boolean) as PriceBoardRow[];
    const rest = list.filter((r) => !pinnedSet.has(r.symbol));
    return [...pinned, ...rest];
  }, [rows, exchange, pinnedSymbols]);

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

  useEffect(() => {
    const pendingSymbol = pendingScrollSymbolRef.current;
    if (!pendingSymbol) return;
    const existsInDisplay = displayRows.some((row) => row.symbol === pendingSymbol);
    if (!existsInDisplay) return;
    tableRef.current?.scrollToSymbol(pendingSymbol);
    pendingScrollSymbolRef.current = null;
    triggerHighlight(pendingSymbol);
  }, [displayRows, triggerHighlight]);

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
        />
        <PriceBoardTable
          ref={tableRef}
          displayRows={displayRows}
          pinnedSymbols={pinnedSymbols}
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
