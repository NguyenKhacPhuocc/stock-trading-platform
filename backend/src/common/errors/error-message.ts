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
    vi: (p) => {
      const t = String(p?.orderType ?? '').toUpperCase();
      if (t === 'ATO') return 'Hệ thống tạm thời chưa hỗ trợ lệnh ATO';
      if (t === 'ATC') return 'Hệ thống tạm thời chưa hỗ trợ lệnh ATC';
      if (t) return `Hệ thống tạm thời chưa hỗ trợ lệnh ${t}`;
      return 'Hệ thống tạm thời chỉ hỗ trợ lệnh LO và MAK';
    },
    en: (p) => {
      const t = String(p?.orderType ?? '').toUpperCase();
      if (t === 'ATO') return 'ATO orders are not supported yet';
      if (t === 'ATC') return 'ATC orders are not supported yet';
      if (t) return `Order type ${t} is not supported yet`;
      return 'Only LO and MAK orders are supported';
    },
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
  FO0019: {
    vi: (p) =>
      `Chưa có mã ${String(p?.symbol ?? 'VCB')} trong hệ thống. Admin cần sync bảng giá SSI trước khi đăng ký.`,
    en: (p) =>
      `Stock ${String(p?.symbol ?? 'VCB')} is not in the system. Run SSI snapshot sync before registration.`,
  },
  FO0020: {
    vi: 'Thông tin định danh đã xác thực, không thể chỉnh sửa trực tuyến',
    en: 'Verified identity fields cannot be edited online',
  },
  FO0021: {
    vi: 'Email đã được sử dụng bởi tài khoản khác',
    en: 'Email is already used by another account',
  },
  FO0022: {
    vi: 'Tài khoản chưa có email — không thể đặt lại mật khẩu trực tuyến',
    en: 'Account has no email on file',
  },
  FO0023: {
    vi: 'Email không khớp với mã khách hàng',
    en: 'Email does not match customer ID',
  },
  FO0024: {
    vi: 'Mã OTP không đúng',
    en: 'Invalid OTP code',
  },
  FO0025: {
    vi: 'Mã OTP đã hết hạn — vui lòng yêu cầu mã mới',
    en: 'OTP expired — request a new code',
  },
  FO0026: {
    vi: 'Vui lòng đợi trước khi yêu cầu mã mới',
    en: 'Please wait before requesting another code',
  },
  FO0027: {
    vi: 'Tài khoản đã có mã PIN giao dịch',
    en: 'Trading PIN is already set',
  },
  FO0028: {
    vi: 'Mã PIN và xác nhận không khớp',
    en: 'PIN confirmation does not match',
  },
  FO0029: {
    vi: 'Phiên xác nhận lệnh đã hết hạn — vui lòng kiểm tra lại trước khi gửi',
    en: 'Order confirmation session expired — run pre-check again',
  },
  FO0030: {
    vi: 'Phiên xác nhận lệnh không hợp lệ',
    en: 'Invalid order confirmation session',
  },
  FO0031: {
    vi: 'Thông tin lệnh không khớp với bước kiểm tra trước — vui lòng thử lại',
    en: 'Order details do not match pre-check — please try again',
  },
  FO0032: {
    vi: 'Tài khoản chưa thiết lập mã PIN giao dịch',
    en: 'Trading PIN is not set for this account',
  },
  FO0033: {
    vi: 'Mã PIN giao dịch không đúng',
    en: 'Invalid trading PIN',
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
