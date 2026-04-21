import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade } from '../../database/entities/trade.entity';

@Injectable()
export class TradesService {
  constructor(@InjectRepository(Trade) private tradeRepo: Repository<Trade>) {}

  getTradesBySymbol(symbol: string, limit = 50) {
    return this.tradeRepo
      .createQueryBuilder('trade')
      .leftJoinAndSelect('trade.buyOrder', 'buyOrder')
      .leftJoinAndSelect('buyOrder.stock', 'stock')
      .where('stock.symbol = :symbol', { symbol: symbol.toUpperCase() })
      .orderBy('trade.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  getUserTrades(userId: string) {
    return this.tradeRepo
      .createQueryBuilder('trade')
      .leftJoinAndSelect('trade.buyOrder', 'buyOrder')
      .leftJoinAndSelect('trade.sellOrder', 'sellOrder')
      .leftJoinAndSelect('buyOrder.tradingAccount', 'buyAccount')
      .leftJoinAndSelect('sellOrder.tradingAccount', 'sellAccount')
      .leftJoinAndSelect('buyOrder.stock', 'stock')
      .where('buyAccount.userId = :userId OR sellAccount.userId = :userId', {
        userId,
      })
      .orderBy('trade.createdAt', 'DESC')
      .getMany();
  }
}
