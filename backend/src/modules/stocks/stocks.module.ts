import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StocksService } from './stocks.service';
import { StocksController } from './stocks.controller';
import { Stock } from '../../database/entities/stock.entity';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [TypeOrmModule.forFeature([Stock]), MarketModule],
  providers: [StocksService],
  controllers: [StocksController],
  exports: [StocksService],
})
export class StocksModule {}
