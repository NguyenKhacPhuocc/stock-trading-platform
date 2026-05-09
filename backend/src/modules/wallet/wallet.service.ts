import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../../database/entities/wallet.entity';
import { Position } from '../../database/entities/position.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { BusinessException } from '../../common/errors/business.exception';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(Position) private positionRepo: Repository<Position>,
    @InjectRepository(TradingAccount)
    private accountRepo: Repository<TradingAccount>,
  ) {}

  /** Lấy TKCK mặc định của user */
  async getDefaultAccount(userId: string): Promise<TradingAccount> {
    const account = await this.accountRepo.findOne({
      where: { userId, isDefault: true },
    });
    if (!account) {
      throw new BusinessException('TRADING_ACCOUNT_NOT_FOUND', undefined, 404);
    }
    return account;
  }

  async getWallet(userId: string) {
    const account = await this.getDefaultAccount(userId);
    const wallet = await this.walletRepo.findOne({
      where: { tradingAccountId: account.id },
      relations: { transactions: true },
      order: { transactions: { createdAt: 'DESC' } },
    });
    if (!wallet) {
      throw new BusinessException('WALLET_NOT_FOUND', undefined, 404);
    }
    const available = Number(wallet.availableBalance);
    const locked = Number(wallet.lockedBalance);
    return {
      ...wallet,
      accountId: account.accountId,
      totalBalance: available + locked,
    };
  }

  async getPositions(userId: string) {
    const account = await this.getDefaultAccount(userId);
    return this.positionRepo.find({
      where: { tradingAccountId: account.id },
      relations: { stock: true },
    });
  }
}
