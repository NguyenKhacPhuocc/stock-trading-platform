import { memo, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, Settings, Video } from 'lucide-react';
import type { ExchangeCode } from './price-board-types';

export type PriceBoardToolbarProps = {
  search: string;
  onSearchChange: (v: string) => void;
  searchSuggestions: Array<{ symbol: string; exchange: ExchangeCode; fullName?: string }>;
  onSelectSuggestion: (symbol: string) => void;
  exchange: ExchangeCode | 'ALL';
  onExchangeChange: (ex: ExchangeCode | 'ALL') => void;
};

export const PriceBoardToolbar = memo(function PriceBoardToolbar({
  search,
  onSearchChange,
  searchSuggestions,
  onSelectSuggestion,
  exchange,
  onExchangeChange,
}: PriceBoardToolbarProps) {
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-board-bg px-1 py-0.5 text-[13px]">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <div ref={searchRef} className="price-search-box relative flex items-center gap-1.5 rounded border border-border/80 bg-board-control px-2 py-1">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          <input
            type="text"
            placeholder="Tìm mã chứng khoán"
            value={search}
            onChange={(e) => {
              onSearchChange(e.target.value.toUpperCase());
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="w-32 border-0 bg-transparent text-xs text-foreground outline-none sm:w-40"
            autoCapitalize="characters"
          />
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="price-search-suggestions">
              {searchSuggestions.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelectSuggestion(item.symbol);
                    setShowSuggestions(false);
                  }}
                  className="price-search-suggestion-item w-full text-left"
                >
                  <span className="price-search-suggestion-symbol">{item.symbol}</span>
                  <span className="price-search-suggestion-exchange">{item.exchange}</span>
                  <span className="price-search-suggestion-name">{item.fullName ?? ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="flex items-center gap-1 rounded border border-border/80 bg-board-control px-2.5 py-1 text-xs text-muted hover:text-foreground"
        >
          Danh mục yêu thích
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        <div className="flex gap-0.5 rounded bg-board-control p-0.5">
          {(['ALL', 'HOSE', 'HNX', 'UPCOM'] as const).map((ex) => {
            const active = exchange === ex;
            return (
              <button
                key={ex}
                type="button"
                onClick={() => onExchangeChange(ex)}
                className={`rounded px-3 py-1 text-xs font-medium ${active
                  ? 'border border-board-tab-active bg-white/10 text-foreground'
                  : 'text-muted hover:bg-white/5 hover:text-foreground'
                  }`}
              >
                {ex === 'ALL' ? 'Tất cả' : ex}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex items-center gap-1 rounded border border-border/80 bg-board-control px-2.5 py-1 text-xs text-muted hover:text-foreground"
        >
          Công cụ
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button type="button" className="rounded p-1.5 text-muted hover:text-foreground" title="Trình chiếu">
          <Video className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rounded p-1.5 text-muted hover:text-foreground" title="Cài đặt">
          <Settings className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rounded p-1.5 text-muted hover:text-foreground" title="Thu gọn">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});
