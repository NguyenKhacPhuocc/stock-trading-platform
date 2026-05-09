import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from '../../database/entities/order.entity';
import { Stock } from '../../database/entities/stock.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Stock,
      StockBoardSnapshot,
      TradingAccount,
      Wallet,
      Position,
      CashTransaction,
    ]),
    MarketModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
