import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradesService } from './trades.service';
import { TradesController } from './trades.controller';
import { Trade } from '../../database/entities/trade.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trade])],
  providers: [TradesService],
  controllers: [TradesController],
})
export class TradesModule {}
