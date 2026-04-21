import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { StocksService } from './stocks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('stocks')
export class StocksController {
  constructor(private stocks: StocksService) {}

  @Get()
  findAll() {
    return this.stocks.findAll();
  }

  @Get(':symbol')
  findOne(@Param('symbol') symbol: string) {
    return this.stocks.findBySymbol(symbol);
  }
}
