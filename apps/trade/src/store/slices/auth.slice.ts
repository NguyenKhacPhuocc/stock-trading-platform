import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: string;
  custId: string;
  fullName: string;
  email: string | null;
  role: 'user' | 'admin';
  hasTradingPin: boolean;
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
  isHydratingSession: boolean;
}

const initialState: AuthState = {
  user: null,
  tradingAccounts: [],
  selectedTradingAccountId: null,
  isAuthenticated: false,
  isHydratingSession: true,
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
      state.isHydratingSession = false;
    },
    setSelectedTradingAccountId(state, action: PayloadAction<string>) {
      if (state.tradingAccounts.some((a) => a.id === action.payload)) {
        state.selectedTradingAccountId = action.payload;
      }
    },
    setHasTradingPin(state) {
      if (state.user) state.user.hasTradingPin = true;
    },
    clearUser(state) {
      state.user = null;
      state.tradingAccounts = [];
      state.selectedTradingAccountId = null;
      state.isAuthenticated = false;
      state.isHydratingSession = false;
    },
    finishHydratingSession(state) {
      state.isHydratingSession = false;
    },
    patchUserProfile(
      state,
      action: PayloadAction<{ fullName?: string; email?: string | null }>,
    ) {
      if (!state.user) return;
      if (action.payload.fullName !== undefined) {
        state.user.fullName = action.payload.fullName;
      }
      if (action.payload.email !== undefined) {
        state.user.email = action.payload.email;
      }
    },
  },
});

export const {
  setSession,
  setSelectedTradingAccountId,
  setHasTradingPin,
  clearUser,
  finishHydratingSession,
  patchUserProfile,
} = authSlice.actions;
export default authSlice.reducer;
