import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../../database/entities/user.entity';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { Stock } from '../../database/entities/stock.entity';
import { SystemConfig } from '../../database/entities/system-config.entity';
import { StocksModule } from '../stocks/stocks.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Order, Trade, Stock, SystemConfig]),
    StocksModule,
    MarketModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
