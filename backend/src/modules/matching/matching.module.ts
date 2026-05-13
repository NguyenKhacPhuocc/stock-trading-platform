import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';
import { Stock } from '../../database/entities/stock.entity';
import { MatchingRegistryService } from './matching-registry.service';
import { MatchingPersistenceService } from './matching-persistence.service';
import { MatchingOrchestratorService } from './matching-orchestrator.service';
import { MarketRealtimePublisherService } from './market-realtime-publisher.service';
import { MatchingQueueService } from './matching-queue.service';
import { OrderbookCacheService } from './orderbook-cache.service';
import { MatchingEventBus } from './matching-event-bus.service';
import { OrderbookWalService } from './orderbook-wal.service';
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
    MatchingRegistryService,
    MatchingPersistenceService,
    OrderbookCacheService,
    MatchingEventBus,
    OrderbookWalService,
    MarketRealtimePublisherService,
    MatchingOrchestratorService,
    MatchingQueueService,
  ],
  exports: [
    MatchingOrchestratorService,
    MatchingQueueService,
    MarketRealtimePublisherService,
  ],
})
export class MatchingModule {}
