import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: string;
  custId: string;
  fullName: string;
  email: string | null;
  role: 'user' | 'admin';
}

export type TradingAccountTypeCode = 'CASH' | 'MARGIN' | 'DERIVATIVE' | 'BOND';
export type TradingAccountChannelCode =
  | 'STOCK'
  | 'DERIVATIVE'
  | 'BOND'
  | 'FUND';

/** Tiểu khoản — `id` = UUID; type/channel/status từ DB, không suy từ account_id. */
export interface TradingAccountSummary {
  id: string;
  accountId: string;
  isDefault: boolean;
  type: TradingAccountTypeCode;
  channel: TradingAccountChannelCode;
  status: 'ACTIVE' | 'INACTIVE';
}

function pickDefaultTradingAccountId(
  accounts: TradingAccountSummary[],
): string | null {
  if (!accounts.length) return null;
  const byFlag = accounts.find((a) => a.isDefault);
  if (byFlag) return byFlag.id;
  const bySuffix = accounts.find((a) => a.accountId.endsWith('.1'));
  if (bySuffix) return bySuffix.id;
  return accounts[0].id;
}

interface AuthState {
  user: AuthUser | null;
  tradingAccounts: TradingAccountSummary[];
  selectedTradingAccountId: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  tradingAccounts: [],
  selectedTradingAccountId: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(
      state,
      action: PayloadAction<{
        user: AuthUser;
        tradingAccounts: TradingAccountSummary[];
      }>,
    ) {
      state.user = action.payload.user;
      state.tradingAccounts = action.payload.tradingAccounts;
      state.selectedTradingAccountId = pickDefaultTradingAccountId(
        action.payload.tradingAccounts,
      );
      state.isAuthenticated = true;
    },
    setSelectedTradingAccountId(state, action: PayloadAction<string>) {
      if (state.tradingAccounts.some((a) => a.id === action.payload)) {
        state.selectedTradingAccountId = action.payload;
      }
    },
    clearUser(state) {
      state.user = null;
      state.tradingAccounts = [];
      state.selectedTradingAccountId = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setSession, setSelectedTradingAccountId, clearUser } =
  authSlice.actions;
export default authSlice.reducer;
