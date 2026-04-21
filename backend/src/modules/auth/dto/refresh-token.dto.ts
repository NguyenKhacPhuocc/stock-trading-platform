import { IsOptional, IsString, MinLength } from 'class-validator';

/** Postman có thể gửi body; trình duyệt dùng cookie httpOnly */
export class RefreshTokenBodyDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  refreshToken?: string;
}
