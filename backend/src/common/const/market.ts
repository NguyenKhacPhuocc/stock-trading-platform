/** Sàn niêm yết / giao dịch — dùng chung entity + DTO */
export enum Exchange {
  HOSE = 'HOSE',
  HNX = 'HNX',
  UPCOM = 'UPCOM',
}

/** Phiên trong ngày — lịch sàn */
export enum TradingSession {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  ALL_DAY = 'all_day',
}
