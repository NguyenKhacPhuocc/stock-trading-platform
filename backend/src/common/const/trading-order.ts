export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

/** Loại lệnh theo nghiệp vụ CK (domain) */
export enum OrderType {
  LO = 'LO',
  ATO = 'ATO',
  ATC = 'ATC',
}

export enum OrderStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}
