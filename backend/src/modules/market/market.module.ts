import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { MarketSnapshotIngest } from '../../database/entities/market-snapshot-ingest.entity';
import { MarketSnapshotIngestService } from './market-snapshot-ingest.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PriceHistory,
      Stock,
      Order,
      Trade,
      StockBoardSnapshot,
      MarketSnapshotIngest,
    ]),
  ],
  providers: [MarketService, MarketSnapshotIngestService],
  controllers: [MarketController],
  exports: [MarketService, MarketSnapshotIngestService],
})
export class MarketModule {}
