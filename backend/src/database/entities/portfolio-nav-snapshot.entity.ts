import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TradingAccount } from './trading-account.entity';

@Entity('portfolio_nav_snapshots')
@Index(['tradingAccountId', 'snapshotAt'])
@Index(['snapshotAt'])
export class PortfolioNavSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trading_account_id', type: 'uuid' })
  tradingAccountId: string;

  @Column({ name: 'snapshot_at', type: 'timestamptz' })
  snapshotAt: Date;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  nav: number;

  @Column({ name: 'cash_total', type: 'numeric', precision: 20, scale: 2 })
  cashTotal: number;

  @Column({ name: 'stock_value', type: 'numeric', precision: 20, scale: 2 })
  stockValue: number;

  @Column({
    name: 'unrealized_pnl',
    type: 'numeric',
    precision: 20,
    scale: 2,
  })
  unrealizedPnL: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => TradingAccount)
  @JoinColumn({ name: 'trading_account_id' })
  tradingAccount: TradingAccount;
}
