import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ForgotPasswordConfirmDto {
  @IsString()
  @MinLength(3)
  custId: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải 6 chữ số' })
  otp: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới tối thiểu 6 ký tự' })
  newPassword: string;
}
