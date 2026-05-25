import { Repository } from 'typeorm';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { TradingAccountStatus } from '../const';
import { BusinessException } from '../errors/business.exception';

/** Tiểu khoản thuộc user và đang ACTIVE — dùng cho mọi API giao dịch/ví. */
export async function resolveTradingAccountForUser(
  repo: Repository<TradingAccount>,
  userId: string,
  tradingAccountId: string,
): Promise<TradingAccount> {
  const account = await repo.findOne({
    where: { id: tradingAccountId, userId },
  });
  if (!account || account.status !== TradingAccountStatus.ACTIVE) {
    throw new BusinessException('TRADING_ACCOUNT_NOT_FOUND', undefined, 404);
  }
  return account;
}
