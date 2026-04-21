import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TradesService } from './trades.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('trades')
export class TradesController {
  constructor(private trades: TradesService) {}

  @Get('my')
  getMyTrades(@CurrentUser() user: { id: string }) {
    return this.trades.getUserTrades(user.id);
  }

  @Get(':symbol')
  getBySymbol(@Param('symbol') symbol: string, @Query('limit') limit?: string) {
    return this.trades.getTradesBySymbol(symbol, limit ? parseInt(limit) : 50);
  }
}
