import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Stock } from './stock.entity';

@Entity('price_histories')
@Unique(['stockId', 'date'])
@Index(['stockId', 'date'])
export class PriceHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stock_id', type: 'uuid' })
  stockId: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  open: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  high: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  low: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  close: number;

  @Column({ type: 'bigint' })
  volume: number;

  @Column({ type: 'date' })
  date: string;

  @ManyToOne(() => Stock, (s) => s.priceHistories)
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
}
