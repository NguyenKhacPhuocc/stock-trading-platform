import {
  IsString,
  IsEnum,
  IsInt,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';
import { OrderSide, OrderType } from '../../../common/const';

/** Tham số kiểm tra trước khi mở modal xác nhận — không ghi DB. */
export class PreCheckOrderDto {
  @IsString()
  stockId: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsEnum(OrderType)
  orderType: OrderType;

  @ValidateIf((o: PreCheckOrderDto) => o.orderType === OrderType.LO)
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsInt()
  @Min(100, { message: 'Số lượng tối thiểu 1 lô (100 cổ phiếu)' })
  quantity: number;
}
