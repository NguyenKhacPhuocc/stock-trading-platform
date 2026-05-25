import { IsString, Length, Matches } from 'class-validator';

export class ChangeTradingPinDto {
  @IsString()
  @Length(6, 6, { message: 'Mã PIN cũ phải đúng 6 chữ số' })
  @Matches(/^\d{6}$/, { message: 'Mã PIN cũ chỉ gồm 6 chữ số' })
  currentPin: string;

  @IsString()
  @Length(6, 6, { message: 'Mã PIN mới phải đúng 6 chữ số' })
  @Matches(/^\d{6}$/, { message: 'Mã PIN mới chỉ gồm 6 chữ số' })
  pin: string;

  @IsString()
  @Length(6, 6, { message: 'Xác nhận PIN phải đúng 6 chữ số' })
  @Matches(/^\d{6}$/, { message: 'Xác nhận PIN chỉ gồm 6 chữ số' })
  confirmPin: string;
}
