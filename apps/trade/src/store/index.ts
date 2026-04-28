import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/ui.slice';
import authReducer from './slices/auth.slice';
import marketReducer from './slices/market.slice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    market: marketReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
