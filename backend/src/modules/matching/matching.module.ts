import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';
import { Stock } from '../../database/entities/stock.entity';
import { MatchingService } from './matching.service';
import { BookRegistry } from './book-registry.service';
import { TradeFillService } from './trade-fill.service';
import { OrderbookWalService } from './orderbook-wal.service';
import { OrderbookRedisService } from './orderbook-redis.service';
import { OrderbookWsService } from './orderbook-ws.service';
import { WebsocketModule } from '../../websocket/websocket.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Trade,
      Wallet,
      Position,
      CashTransaction,
      Stock,
    ]),
    forwardRef(() => WebsocketModule),
    forwardRef(() => MarketModule),
  ],
  providers: [
    BookRegistry,
    TradeFillService,
    OrderbookWalService,
    OrderbookRedisService,
    OrderbookWsService,
    MatchingService,
  ],
  exports: [MatchingService],
})
export class MatchingModule {}
