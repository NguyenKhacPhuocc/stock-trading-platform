import {
  IsString,
  IsEnum,
  IsInt,
  IsNumber,
  IsUUID,
  Min,
  MinLength,
  MaxLength,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { OrderSide, OrderType } from '../../../common/const';

export class CreateOrderDto {
  /** Tiểu khoản đặt lệnh — phải trùng pre-check intent. */
  @IsUUID()
  tradingAccountId: string;

  /** Idempotency — UUID hoặc chuỗi unique do FE sinh. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  clientOrderId: string;

  @IsString()
  stockId: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsEnum(OrderType)
  orderType: OrderType;

  /** LO: bắt buộc. MAK: server tự lấy trần/sàn từ snapshot. */
  @ValidateIf((o: CreateOrderDto) => o.orderType === OrderType.LO)
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsInt()
  @Min(100, { message: 'Số lượng tối thiểu 1 lô (100 cổ phiếu)' })
  quantity: number;

  /** Từ pre-check — bắt buộc. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  requestId: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  transactionId: string;

  @IsString()
  @MinLength(16)
  @MaxLength(128)
  tokenId: string;

  /** PIN giao dịch 6 số — xác thực trước khi ghi lệnh. */
  @IsString()
  @Length(6, 6, { message: 'Mã PIN phải đúng 6 chữ số' })
  @Matches(/^\d{6}$/, { message: 'Mã PIN chỉ gồm 6 chữ số' })
  pin: string;
}
