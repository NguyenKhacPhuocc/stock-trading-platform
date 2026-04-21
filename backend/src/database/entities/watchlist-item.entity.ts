import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Watchlist } from './watchlist.entity';
import { Stock } from './stock.entity';

@Entity('watchlist_items')
@Unique(['watchlistId', 'stockId'])
export class WatchlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'watchlist_id', type: 'uuid' })
  watchlistId: string;

  @Column({ name: 'stock_id', type: 'uuid' })
  stockId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Watchlist, (w) => w.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'watchlist_id' })
  watchlist: Watchlist;

  @ManyToOne(() => Stock, (s) => s.watchlistItems)
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
}
