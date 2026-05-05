import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MarketBoardGatewayD } from '@stock/types';
import { parseApiEnvelopeJson } from '@stock/utils';
import type { ExchangeCode, PriceBoardRow } from '@/components/priceboard/price-board-types';
import { gatewayMarketBoardPath } from '@/lib/gateway-paths';

type MarketInstrumentApi = {
  stockId: string;
  symbol: string;
  exchange: string;
  reference: number;
  ceiling: number;
  floor: number;
  bidPrice3: number;
  bidVol3: number;
  bidPrice2: number;
  bidVol2: number;
  bidPrice1: number;
  bidVol1: number;
  closePrice: number;
  closeVol: number;
  priceChange?: number;
  priceChangePercent?: number;
  offerPrice1: number;
  offerVol1: number;
  offerPrice2: number;
  offerVol2: number;
  offerPrice3: number;
  offerVol3: number;
  totalTrading: number;
  high: number;
  low: number;
};

export type PriceBoardSearchItem = {
  symbol: string;
  exchange: ExchangeCode;
  fullName?: string;
};

type MarketBootstrapPayload = {
  entities: Record<string, PriceBoardRow>;
  orderSymbols: string[];
  exchangeBySymbol: Record<string, ExchangeCode>;
  searchUniverse: PriceBoardSearchItem[] | null;
};

type MarketState = {
  entities: Record<string, PriceBoardRow>;
  orderSymbols: string[];
  exchangeBySymbol: Record<string, ExchangeCode>;
  searchUniverse: PriceBoardSearchItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastSyncedAt: number | null;
};

const initialState: MarketState = {
  entities: {},
  orderSymbols: [],
  exchangeBySymbol: {},
  searchUniverse: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastSyncedAt: null,
};

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapInstrumentToRow(item: MarketInstrumentApi): PriceBoardRow {
  return {
    id: item.stockId || item.symbol,
    symbol: item.symbol,
    exchange: (item.exchange || 'HOSE') as PriceBoardRow['exchange'],
    ref: toNumber(item.reference),
    ceil: toNumber(item.ceiling),
    floor: toNumber(item.floor),
    bid3: { p: toNumber(item.bidPrice3), v: toNumber(item.bidVol3) },
    bid2: { p: toNumber(item.bidPrice2), v: toNumber(item.bidVol2) },
    bid1: { p: toNumber(item.bidPrice1), v: toNumber(item.bidVol1) },
    match: {
      p: toNumber(item.closePrice),
      v: toNumber(item.closeVol),
      priceChange: toNumber(item.priceChange),
      priceChangePercent: toNumber(item.priceChangePercent),
    },
    ask1: { p: toNumber(item.offerPrice1), v: toNumber(item.offerVol1) },
    ask2: { p: toNumber(item.offerPrice2), v: toNumber(item.offerVol2) },
    ask3: { p: toNumber(item.offerPrice3), v: toNumber(item.offerVol3) },
    totalVol: toNumber(item.totalTrading),
    high: toNumber(item.high),
    low: toNumber(item.low),
  };
}

function mapQuotesToSearchUniverse(payload: unknown[]): PriceBoardSearchItem[] {
  const normalized = (payload as Array<Record<string, unknown>>)
    .map((item) => ({
      symbol: String(item.symbol ?? '').toUpperCase(),
      exchange: String(item.exchange ?? '').toUpperCase() as ExchangeCode,
      fullName: typeof item.fullName === 'string' ? item.fullName : undefined,
    }))
    .filter((item) => item.symbol && item.exchange)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  return normalized;
}

type MarketThunkGetState = () => { market: MarketState };

export const fetchMarketRows = createAsyncThunk<
  MarketBootstrapPayload,
  { exchange?: 'HOSE' | 'HNX' | 'UPCOM' | 'ALL' } | undefined,
  { rejectValue: string; state: ReturnType<MarketThunkGetState> }
>('market/fetchRows', async (params, { rejectWithValue, getState }) => {
  try {
    const exchange = params?.exchange;
    const loadQuotes = getState().market.searchUniverse.length === 0;
    const path = gatewayMarketBoardPath({
      exchange: exchange && exchange !== 'ALL' ? exchange : undefined,
      withQuotes: loadQuotes,
    });
    const res = await fetch(path, { credentials: 'same-origin' });
    const parsed = parseApiEnvelopeJson<MarketBoardGatewayD>(await res.json());
    if (!parsed.ok) return rejectWithValue(parsed.em);
    if (!res.ok) return rejectWithValue('Không tải được dữ liệu bảng giá');

    const instruments = Array.isArray(parsed.d.instruments) ? parsed.d.instruments : [];
    const entities: Record<string, PriceBoardRow> = {};
    const orderSymbols: string[] = [];
    const exchangeBySymbol: Record<string, ExchangeCode> = {};
    (instruments as MarketInstrumentApi[]).forEach((item) => {
      const row = mapInstrumentToRow(item);
      entities[row.symbol] = row;
      orderSymbols.push(row.symbol);
      exchangeBySymbol[row.symbol] = row.exchange;
    });
    orderSymbols.sort((a, b) => a.localeCompare(b));

    const quotes = parsed.d.quotes;
    const searchUniverse = Array.isArray(quotes) ? mapQuotesToSearchUniverse(quotes) : null;

    return { entities, orderSymbols, exchangeBySymbol, searchUniverse };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Không tải được dữ liệu bảng giá';
    return rejectWithValue(message);
  }
});

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    /**
     * Socket tick update: patch đúng symbol, không recreate toàn bộ dataset.
     * Giả định patch có thể chứa partial top-level hoặc partial nested (bid3/match/ask...).
     */
    batchPatchRows: (
      state,
      action: PayloadAction<Array<{ symbol: string; patch: Partial<PriceBoardRow> }>>,
    ) => {
      for (const { symbol, patch } of action.payload) {
        const current = state.entities[symbol];
        if (!current) continue;

        const next: PriceBoardRow = {
          ...current,
          ...patch,
          bid3: patch.bid3 ? { ...current.bid3, ...patch.bid3 } : current.bid3,
          bid2: patch.bid2 ? { ...current.bid2, ...patch.bid2 } : current.bid2,
          bid1: patch.bid1 ? { ...current.bid1, ...patch.bid1 } : current.bid1,
          match: patch.match ? { ...current.match, ...patch.match } : current.match,
          ask1: patch.ask1 ? { ...current.ask1, ...patch.ask1 } : current.ask1,
          ask2: patch.ask2 ? { ...current.ask2, ...patch.ask2 } : current.ask2,
          ask3: patch.ask3 ? { ...current.ask3, ...patch.ask3 } : current.ask3,
        };

        state.entities[symbol] = next;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMarketRows.pending, (state) => {
        state.error = null;
        if (state.orderSymbols.length === 0) state.isLoading = true;
        else state.isRefreshing = true;
      })
      .addCase(fetchMarketRows.fulfilled, (state, action) => {
        state.entities = action.payload.entities;
        state.orderSymbols = action.payload.orderSymbols;
        state.exchangeBySymbol = action.payload.exchangeBySymbol;
        if (action.payload.searchUniverse !== null) {
          state.searchUniverse = action.payload.searchUniverse;
        }
        state.isLoading = false;
        state.isRefreshing = false;
        state.lastSyncedAt = Date.now();
      })
      .addCase(fetchMarketRows.rejected, (state, action) => {
        state.isLoading = false;
        state.isRefreshing = false;
        state.error = action.payload ?? 'Không tải được dữ liệu bảng giá';
      });
  },
});

export const { batchPatchRows } = marketSlice.actions;
export default marketSlice.reducer;
