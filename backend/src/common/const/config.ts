/**
 * Mã tổ chức (broker) mặc định — dùng làm fallback khi chưa có trong system_configs.
 * Giá trị thật đọc từ DB key `broker.org_code`; hằng này chỉ là default seed/fallback.
 */
export const DEFAULT_ORG_CODE = '025';

/** System config keys — tập trung tránh magic string rải rác */
export const ConfigKey = {
  BROKER_ORG_CODE: 'broker.org_code',
  BROKER_SEQ_CUSTOMER: 'broker.seq.customer',
  BROKER_SEQ_ADMIN: 'broker.seq.admin',
} as const;
