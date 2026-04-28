import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiClient } from '@stock/utils';
import type { PriceBoardRow } from '@/components/priceboard/price-board-types';

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

type MarketState = {
  rows: PriceBoardRow[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastSyncedAt: number | null;
};

const initialState: MarketState = {
  rows: [],
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

export const fetchMarketRows = createAsyncThunk<
  PriceBoardRow[],
  { exchange?: 'HOSE' | 'HNX' | 'UPCOM' | 'ALL' } | undefined,
  { rejectValue: string }
>('market/fetchRows', async (params, { rejectWithValue }) => {
  try {
    const exchange = params?.exchange;
    const res = await apiClient.get('/market/instruments', {
      params: exchange && exchange !== 'ALL' ? { exchange } : undefined,
    });
    const payload = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.d) ? res.data.d : [];
    const rows = (payload as MarketInstrumentApi[]).map(mapInstrumentToRow);
    rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return rows;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Không tải được dữ liệu bảng giá';
    return rejectWithValue(message);
  }
});

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMarketRows.pending, (state) => {
        state.error = null;
        if (state.rows.length === 0) state.isLoading = true;
        else state.isRefreshing = true;
      })
      .addCase(fetchMarketRows.fulfilled, (state, action) => {
        state.rows = action.payload;
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

export default marketSlice.reducer;

