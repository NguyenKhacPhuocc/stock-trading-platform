import { IsEmail, IsString, MinLength } from 'class-validator';

export class ForgotPasswordRequestDto {
  @IsString()
  @MinLength(3)
  custId: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;
}
