export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  BUY_LOCK = 'buy_lock', // Phong tỏa tiền khi đặt lệnh mua
  BUY_UNLOCK = 'buy_unlock', // Hoàn tiền khi hủy lệnh mua
  BUY_MATCHED = 'buy_matched', // Trừ tiền khi lệnh mua khớp
  SELL_MATCHED = 'sell_matched', // Cộng tiền khi lệnh bán khớp
  FEE = 'fee',
  ADJUSTMENT = 'adjustment',
}
