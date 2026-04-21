import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @Matches(/^[0-9]{10,11}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;
}
