import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Order } from './order.entity';
import { Position } from './position.entity';
import { PriceHistory } from './price-history.entity';
import { AIAnalysis } from './ai-analysis.entity';
import { WatchlistItem } from './watchlist-item.entity';
import { Exchange } from '../../common/const';

@Entity('stocks')
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 10 })
  @Index()
  symbol: string;

  @Column({ length: 256 })
  name: string;

  @Column({ type: 'enum', enum: Exchange })
  exchange: Exchange;

  /** Biên độ trần (%) theo sàn: HOSE 7, HNX 10, UPCOM 15 */
  @Column({
    name: 'ceil_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 7,
  })
  ceilPct: number;

  /** Biên độ sàn (%) — thường bằng ceil_pct */
  @Column({
    name: 'floor_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 7,
  })
  floorPct: number;

  /** Bước giá tối thiểu (VND) */
  @Column({
    name: 'tick_size',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 100,
  })
  tickSize: number;

  /** Lô giao dịch tối thiểu (cổ phiếu) */
  @Column({ name: 'lot_size', default: 100 })
  lotSize: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Order, (o) => o.stock)
  orders: Order[];

  @OneToMany(() => Position, (p) => p.stock)
  positions: Position[];

  @OneToMany(() => PriceHistory, (ph) => ph.stock)
  priceHistories: PriceHistory[];

  @OneToMany(() => AIAnalysis, (a) => a.stock)
  aiAnalyses: AIAnalysis[];

  @OneToMany(() => WatchlistItem, (wi) => wi.stock)
  watchlistItems: WatchlistItem[];
}
