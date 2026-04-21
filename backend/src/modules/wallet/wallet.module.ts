import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Position, TradingAccount])],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
