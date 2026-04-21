import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketService } from './market.service';

/** Dữ liệu thị trường đọc công khai — không yêu cầu đăng nhập */
@Controller('market')
export class MarketController {
  constructor(private market: MarketService) {}

  /**
   * Master data: symbol, trần/sàn/TC, thông tin mã.
   * ?symbols=ALL (mặc định) hoặc ?symbols=VCB,HPG,FPT
   */
  @Get('quotes')
  getQuotes(@Query('symbols') symbols?: string) {
    return this.market.getQuotes(symbols);
  }

  @Get('prices')
  getPrices() {
    return this.market.getPrices();
  }

  /** Bảng giá dạng snapshot — ?exchange=HOSE|HNX|UPCOM (tùy chọn) */
  @Get('instruments')
  getInstruments(@Query('exchange') exchange?: string) {
    return this.market.getInstruments(exchange);
  }

  @Get('history/:symbol')
  getPriceHistory(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: string,
  ) {
    return this.market.getPriceHistory(symbol, limit ? parseInt(limit) : 100);
  }
}
