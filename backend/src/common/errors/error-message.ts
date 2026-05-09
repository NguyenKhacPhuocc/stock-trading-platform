import {
  ERROR_CONST,
  type AppErrorCode,
  type AppErrorKey,
} from './error-const';

type TemplateParams = Record<string, string | number | undefined>;
type MessageTemplate = string | ((params?: TemplateParams) => string);

type LocalizedMessage = {
  vi: MessageTemplate;
  en: MessageTemplate;
};

const ERROR_MESSAGES: Record<AppErrorCode, LocalizedMessage> = {
  FO0001: {
    vi: (p) =>
      `Giá nằm ngoài biên độ (${String(p?.floor ?? '?')} – ${String(p?.ceiling ?? '?')})`,
    en: (p) =>
      `Price is outside the allowed band (${String(p?.floor ?? '?')} – ${String(p?.ceiling ?? '?')})`,
  },
  FO0002: {
    vi: 'Hiện tại chỉ hỗ trợ lệnh LO cho flow trading core',
    en: 'Only LO orders are currently supported in trading core flow',
  },
  FO0003: {
    vi: 'Số lượng phải là bội số của 100 (lô chẵn)',
    en: 'Quantity must be a multiple of 100',
  },
  FO0004: {
    vi: 'Lệnh LO cần có giá đặt hợp lệ',
    en: 'LO order requires a valid price',
  },
  FO0005: {
    vi: 'Mã chứng khoán không tồn tại',
    en: 'Stock symbol does not exist',
  },
  FO0006: {
    vi: 'Số dư không đủ để đặt lệnh mua',
    en: 'Insufficient balance for buy order',
  },
  FO0007: {
    vi: 'Số lượng có thể bán không đủ',
    en: 'Insufficient sellable quantity',
  },
  FO0008: {
    vi: 'Không thể hủy lệnh này',
    en: 'This order cannot be cancelled',
  },
  FO0009: {
    vi: 'Chưa có dữ liệu tham chiếu hiện tại để kiểm tra biên độ giá',
    en: 'Missing current reference data to validate price band',
  },
  FO0010: {
    vi: 'Không tìm thấy tài khoản giao dịch',
    en: 'Trading account not found',
  },
  FO0011: {
    vi: 'Không tìm thấy ví giao dịch',
    en: 'Trading wallet not found',
  },
  FO0012: {
    vi: 'Mật khẩu hiện tại không đúng',
    en: 'Current password is incorrect',
  },
  FO0013: {
    vi: 'Mã đăng nhập hoặc mật khẩu không đúng',
    en: 'Invalid username or password',
  },
  FO0014: {
    vi: 'Thiếu refresh token',
    en: 'Missing refresh token',
  },
  FO0015: {
    vi: 'Refresh token không hợp lệ hoặc đã hết hạn',
    en: 'Refresh token is invalid or expired',
  },
  FO0016: {
    vi: 'custId đã tồn tại, vui lòng thử lại.',
    en: 'custId already exists, please retry',
  },
  FO0017: {
    vi: 'Đăng ký thất bại, vui lòng thử lại',
    en: 'Registration failed, please retry',
  },
  FO0018: {
    vi: 'Token không hợp lệ',
    en: 'Invalid token',
  },
};

function renderTemplate(
  template: MessageTemplate,
  params?: TemplateParams,
): string {
  return typeof template === 'function' ? template(params) : template;
}

export function resolveAppError(args: {
  key: AppErrorKey;
  locale?: 'vi' | 'en';
  params?: TemplateParams;
}): { ec: AppErrorCode; em: string } {
  const ec = ERROR_CONST[args.key];
  const localized = ERROR_MESSAGES[ec];
  const locale = args.locale === 'en' ? 'en' : 'vi';
  return {
    ec,
    em: renderTemplate(localized[locale], args.params),
  };
}
