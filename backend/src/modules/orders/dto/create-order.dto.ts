import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { OrderSide, OrderType } from '../../../common/const';

export class CreateOrderDto {
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
}
