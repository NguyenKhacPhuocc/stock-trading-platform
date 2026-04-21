import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { OrderSide, OrderType } from '../../../common/const';

export class CreateOrderDto {
  @IsString()
  stockId: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsEnum(OrderType)
  orderType: OrderType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsInt()
  @Min(100, { message: 'Số lượng tối thiểu 1 lô (100 cổ phiếu)' })
  quantity: number;
}
