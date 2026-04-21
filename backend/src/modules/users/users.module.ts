import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../database/entities/user.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, TradingAccount])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
