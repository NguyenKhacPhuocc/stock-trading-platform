import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SystemConfig } from '../entities/system-config.entity';
import { User } from '../entities/user.entity';
import { CustomerProfile } from '../entities/customer-profile.entity';
import { TradingAccount } from '../entities/trading-account.entity';
import { Wallet } from '../entities/wallet.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemConfig,
      User,
      CustomerProfile,
      TradingAccount,
      Wallet,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
