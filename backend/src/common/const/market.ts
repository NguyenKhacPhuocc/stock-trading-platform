/** Board mặc định khi đồng bộ SSI (vd `boardId=MAIN`). */
export const DEFAULT_STOCK_BOARD_ID = 'MAIN';

/** Sàn niêm yết / giao dịch — dùng chung entity + DTO */
export enum Exchange {
  HOSE = 'HOSE',
  HNX = 'HNX',
  UPCOM = 'UPCOM',
}

/** Nguồn đồng bộ snapshot tham chiếu vào DB */
export enum MarketSnapshotSource {
  SSI = 'ssi',
}

/** Trạng thái một lần chạy ingest (có thể nhiều dòng / ngày khi retry) */
export enum MarketSnapshotIngestStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/** Phiên trong ngày — lịch sàn */
export enum TradingSession {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  ALL_DAY = 'all_day',
}
