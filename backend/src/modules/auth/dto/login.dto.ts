import { IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  /** CustId — mã khách (VD: 025C000001). Đăng nhập bằng custId + mật khẩu. */
  @IsString()
  @Matches(/^[0-9A-Z]{3}[CA][0-9]{6}$/i, {
    message: 'Mã đăng nhập không hợp lệ (ví dụ: 025C000001)',
  })
  custId: string;

  @IsString()
  @MinLength(6)
  password: string;
}
