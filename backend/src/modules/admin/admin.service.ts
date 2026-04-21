import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Order } from '../../database/entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { Stock } from '../../database/entities/stock.entity';
import { SystemConfig } from '../../database/entities/system-config.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Trade) private tradeRepo: Repository<Trade>,
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
  ) {}

  async getStats() {
    const [totalUsers, totalOrders, totalTrades, totalStocks] =
      await Promise.all([
        this.userRepo.count(),
        this.orderRepo.count(),
        this.tradeRepo.count(),
        this.stockRepo.count(),
      ]);
    return { totalUsers, totalOrders, totalTrades, totalStocks };
  }

  async getUsers(page = 1, limit = 20) {
    const [users, total] = await this.userRepo.findAndCount({
      select: [
        'id',
        'custId',
        'fullName',
        'email',
        'role',
        'isActive',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { users, total, page, limit };
  }

  async toggleUserActive(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    await this.userRepo.update(userId, { isActive: !user?.isActive });
    return this.userRepo.findOne({ where: { id: userId } });
  }

  getConfigs() {
    return this.configRepo.find();
  }

  async setConfig(key: string, value: string, description?: string) {
    const existing = await this.configRepo.findOne({ where: { key } });
    if (existing) {
      await this.configRepo.update({ key }, { value, description });
      return this.configRepo.findOne({ where: { key } });
    }
    const config = this.configRepo.create({ key, value, description });
    return this.configRepo.save(config);
  }
}
