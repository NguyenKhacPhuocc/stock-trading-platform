import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../../database/entities/user.entity';
import { CustomerProfile } from '../../database/entities/customer-profile.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { SystemConfig } from '../../database/entities/system-config.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([
      User,
      CustomerProfile,
      TradingAccount,
      Wallet,
      SystemConfig,
      RefreshToken,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn =
          config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          config.get<string>('JWT_EXPIRES_IN') ??
          '15m';
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresIn as SignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}
