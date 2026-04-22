import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { StocksService } from '../stocks/stocks.service';
import { CreateStockDto } from '../stocks/dto/create-stock.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/const';
import { IsString, IsOptional } from 'class-validator';

class SetConfigDto {
  @IsString() value: string;
  @IsOptional() @IsString() description?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private admin: AdminService,
    private stocks: StocksService,
  ) {}

  @Post('stocks')
  @HttpCode(HttpStatus.CREATED)
  createStock(@Body() dto: CreateStockDto) {
    return this.stocks.create(dto);
  }

  @Get('stats')
  getStats() {
    return this.admin.getStats();
  }

  @Get('users')
  getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.admin.getUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Patch('users/:id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.admin.toggleUserActive(id);
  }

  @Get('configs')
  getConfigs() {
    return this.admin.getConfigs();
  }

  @Patch('configs/:key')
  setConfig(@Param('key') key: string, @Body() dto: SetConfigDto) {
    return this.admin.setConfig(key, dto.value, dto.description);
  }

  @Post('market/snapshot/refresh')
  @HttpCode(HttpStatus.OK)
  forceRefreshMarketSnapshot() {
    return this.admin.forceRefreshMarketSnapshot();
  }
}
