import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { Watchlist } from '../../database/entities/watchlist.entity';
import { WatchlistItem } from '../../database/entities/watchlist-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Watchlist, WatchlistItem])],
  providers: [WatchlistService],
  controllers: [WatchlistController],
})
export class WatchlistModule {}
