import {
  IsString,
  MinLength,
  IsOptional,
  Matches,
  IsEmail,
  Length,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  fullName: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  password: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @IsOptional()
  @Matches(/^[0-9]{10,11}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  /**
   * Số CCCD / CMND — nhập bất kỳ để mô phỏng KYC.
   * Nếu cung cấp → kycStatus = simulated_verified.
   */
  @IsOptional()
  @IsString()
  @Length(9, 32)
  nationalIdNumber?: string;

  /** Ngày sinh (YYYY-MM-DD), map cột date trong DB */
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Ngày sinh dạng YYYY-MM-DD' })
  dateOfBirth?: string;

  /** Địa chỉ thường trú / nhận thư CK */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;
}
