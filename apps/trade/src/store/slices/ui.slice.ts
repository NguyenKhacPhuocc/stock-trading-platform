import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  // Mã cổ phiếu đang được chọn xem / giao dịch
  selectedSymbol: string;
  // Sidebar mở/đóng trên mobile
  sidebarOpen: boolean;
  // Modal đặt lệnh
  orderModalOpen: boolean;
}

const initialState: UiState = {
  selectedSymbol: 'VNM',
  sidebarOpen: false,
  orderModalOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedSymbol(state, action: PayloadAction<string>) {
      state.selectedSymbol = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setOrderModalOpen(state, action: PayloadAction<boolean>) {
      state.orderModalOpen = action.payload;
    },
  },
});

export const { setSelectedSymbol, toggleSidebar, setOrderModalOpen } = uiSlice.actions;
export default uiSlice.reducer;
