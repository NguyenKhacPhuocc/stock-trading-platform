import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Watchlist } from '../../database/entities/watchlist.entity';
import { WatchlistItem } from '../../database/entities/watchlist-item.entity';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(Watchlist) private listRepo: Repository<Watchlist>,
    @InjectRepository(WatchlistItem)
    private itemRepo: Repository<WatchlistItem>,
  ) {}

  getWatchlists(userId: string) {
    return this.listRepo.find({
      where: { userId },
      relations: { items: { stock: true } },
    });
  }

  createWatchlist(userId: string, name: string) {
    const watchlist = this.listRepo.create({ userId, name });
    return this.listRepo.save(watchlist);
  }

  async addItem(watchlistId: string, stockId: string, userId: string) {
    await this.assertOwner(watchlistId, userId);
    const item = this.itemRepo.create({ watchlistId, stockId });
    return this.itemRepo.save(item);
  }

  async removeItem(watchlistId: string, stockId: string, userId: string) {
    await this.assertOwner(watchlistId, userId);
    return this.itemRepo.delete({ watchlistId, stockId });
  }

  async deleteWatchlist(id: string, userId: string) {
    await this.assertOwner(id, userId);
    return this.listRepo.delete({ id });
  }

  private async assertOwner(watchlistId: string, userId: string) {
    const found = await this.listRepo.findOne({
      where: { id: watchlistId, userId },
    });
    if (!found) throw new NotFoundException('Không tìm thấy watchlist');
  }
}
