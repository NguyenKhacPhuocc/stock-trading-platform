import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SystemConfig } from '../entities/system-config.entity';
import { User } from '../entities/user.entity';
import { CustomerProfile } from '../entities/customer-profile.entity';
import { TradingAccount } from '../entities/trading-account.entity';
import { Wallet } from '../entities/wallet.entity';
import { Position } from '../entities/position.entity';
import { WalletModule } from '../../modules/wallet/wallet.module';

@Module({
  imports: [
    WalletModule,
    TypeOrmModule.forFeature([
      SystemConfig,
      User,
      CustomerProfile,
      TradingAccount,
      Wallet,
      Position,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
