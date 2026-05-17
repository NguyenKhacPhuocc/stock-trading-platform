import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { Stock } from '../../database/entities/stock.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { CashTransaction } from '../../database/entities/cash-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet,
      Position,
      TradingAccount,
      Stock,
      StockBoardSnapshot,
      CashTransaction,
    ]),
  ],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
