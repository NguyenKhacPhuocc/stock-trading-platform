import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  IsInt,
  MaxLength,
  Length,
} from 'class-validator';
import { Exchange } from '../../../common/const';

export class CreateStockDto {
  @IsString()
  @Length(1, 10)
  symbol: string;

  @IsString()
  @MaxLength(256)
  name: string;

  @IsEnum(Exchange)
  exchange: Exchange;

  /** Mặc định MAIN — khớp SSI `boardId` */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  boardId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ceilPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  floorPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  tickSize?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lotSize?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
