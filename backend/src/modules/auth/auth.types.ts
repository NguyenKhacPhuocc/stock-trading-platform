import type { UserRole } from '../../common/const';

export interface AuthUserPublicDto {
  id: string;
  custId: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  /** false → FE bắt buộc modal thiết lập PIN. */
  hasTradingPin: boolean;
}

/** Session tối thiểu — danh sách tiểu khoản lấy qua GET /users/me/accounts */
export interface AuthSessionDto {
  user: AuthUserPublicDto;
}

export interface AuthTokensPayload extends AuthSessionDto {
  accessToken: string;
  refreshToken: string;
}
