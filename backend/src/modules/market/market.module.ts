import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PriceHistory,
      Stock,
      Order,
      Trade,
      StockBoardSnapshot,
    ]),
  ],
  providers: [MarketService],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
