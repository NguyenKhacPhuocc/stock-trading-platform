import {
  IsString,
  IsOptional,
  MinLength,
  Matches,
  IsEmail,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @Matches(/^[0-9]{10,11}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  /** Chuỗi rỗng = xóa email. Sau này đổi email bắt OTP trước khi apply. */
  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  /** Dự phòng OTP SĐT — chưa dùng, thêm verify ở service sau. */
  @IsOptional()
  @IsString()
  contactOtpPhone?: string;

  /** Dự phòng OTP email — chưa dùng, thêm verify ở service sau. */
  @IsOptional()
  @IsString()
  contactOtpEmail?: string;
}
