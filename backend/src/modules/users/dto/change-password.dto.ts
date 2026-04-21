import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới tối thiểu 6 ký tự' })
  newPassword: string;
}
