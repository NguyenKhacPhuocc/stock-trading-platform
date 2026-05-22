export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

/** Loại lệnh theo nghiệp vụ CK (domain) */
export enum OrderType {
  LO = 'LO',
  MAK = 'MAK',
  ATO = 'ATO',
  ATC = 'ATC',
}

export enum OrderStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  /** MAK (và tương lai MOK): đã khớp một phần, phần dư bị hủy — giữ quantity gốc. */
  PARTIAL_CANCELLED = 'partial_cancelled',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}
