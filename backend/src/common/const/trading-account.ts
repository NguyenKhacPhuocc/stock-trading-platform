export enum TradingAccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

/**
 * Cơ chế vốn tiểu khoản — cột DB riêng, không suy từ suffix `.1` / `.5`.
 * CASH: không vay | MARGIN: có vay | DERIVATIVE/BOND: nghiệp vụ mở rộng.
 */
export enum TradingAccountType {
  CASH = 'CASH',
  MARGIN = 'MARGIN',
  DERIVATIVE = 'DERIVATIVE',
  BOND = 'BOND',
}

/**
 * Kênh sản phẩm — độc lập với account_type (không gộp, không suy từ account_id).
 */
export enum TradingAccountChannel {
  STOCK = 'STOCK',
  DERIVATIVE = 'DERIVATIVE',
  BOND = 'BOND',
  FUND = 'FUND',
}

/** Trạng thái hiển thị API danh sách tiểu khoản (đơn giản hóa lifecycle DB). */
export type TradingAccountApiLifecycle = 'ACTIVE' | 'INACTIVE';

export function tradingAccountStatusToApi(
  s: TradingAccountStatus,
): TradingAccountApiLifecycle {
  return s === TradingAccountStatus.ACTIVE ? 'ACTIVE' : 'INACTIVE';
}
