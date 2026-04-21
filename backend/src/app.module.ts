import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { SeedModule } from './database/seed/seed.module';
import { RedisModule } from './redis/redis.module';
import { WebsocketModule } from './websocket/websocket.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StocksModule } from './modules/stocks/stocks.module';
import { MarketModule } from './modules/market/market.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TradesModule } from './modules/trades/trades.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SeedModule,
    RedisModule,
    WebsocketModule,
    AuthModule,
    UsersModule,
    StocksModule,
    MarketModule,
    OrdersModule,
    TradesModule,
    WalletModule,
    WatchlistModule,
    NotificationsModule,
    AdminModule,
    AiModule,
  ],
})
export class AppModule {}
