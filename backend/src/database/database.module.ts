import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { CustomerProfile } from './entities/customer-profile.entity';
import { TradingAccount } from './entities/trading-account.entity';
import { Stock } from './entities/stock.entity';
import { Wallet } from './entities/wallet.entity';
import { CashTransaction } from './entities/cash-transaction.entity';
import { Position } from './entities/position.entity';
import { Order } from './entities/order.entity';
import { Trade } from './entities/trade.entity';
import { PriceHistory } from './entities/price-history.entity';
import { AIAnalysis } from './entities/ai-analysis.entity';
import { Watchlist } from './entities/watchlist.entity';
import { WatchlistItem } from './entities/watchlist-item.entity';
import { Notification } from './entities/notification.entity';
import { ExchangeCalendar } from './entities/exchange-calendar.entity';
import { SystemConfig } from './entities/system-config.entity';
import { AuditLog } from './entities/audit-log.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { StockBoardSnapshot } from './entities/stock-board-snapshot.entity';
import { MarketSnapshotIngest } from './entities/market-snapshot-ingest.entity';

export const ALL_ENTITIES = [
  User,
  CustomerProfile,
  TradingAccount,
  Stock,
  Wallet,
  CashTransaction,
  Position,
  Order,
  Trade,
  PriceHistory,
  AIAnalysis,
  Watchlist,
  WatchlistItem,
  Notification,
  ExchangeCalendar,
  SystemConfig,
  AuditLog,
  RefreshToken,
  StockBoardSnapshot,
  MarketSnapshotIngest,
];

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', '123456'),
        database: config.get('DB_DATABASE', 'stock_db'),
        // synchronize: true chỉ dùng khi dev, KHÔNG dùng production
        synchronize: config.get('DB_SYNCHRONIZE', 'true') === 'true',
        entities: ALL_ENTITIES,
        logging: config.get('NODE_ENV') === 'development' ? ['error'] : false,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
