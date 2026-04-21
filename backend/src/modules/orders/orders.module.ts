import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from '../../database/entities/order.entity';
import { Stock } from '../../database/entities/stock.entity';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Stock, PriceHistory, TradingAccount]),
    MarketModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
