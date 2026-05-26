import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TradingAccount } from './trading-account.entity';
import { Stock } from './stock.entity';
import { StockLedgerType } from '../../common/const/stock-ledger';

/** Sổ biến động CP — append-only. */
@Entity('position_transactions')
@Index(['tradingAccountId', 'createdAt'])
@Index(['tradingAccountId', 'stockId', 'createdAt'])
export class PositionTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trading_account_id', type: 'uuid' })
  tradingAccountId: string;

  @Column({ name: 'stock_id', type: 'uuid' })
  stockId: string;

  @Column({ type: 'enum', enum: StockLedgerType })
  type: StockLedgerType;

  /** Biến động KL khả dụng (+ mua / − phong tỏa bán). */
  @Column({ name: 'quantity_delta', type: 'int' })
  quantityDelta: number;

  /** Biến động KL phong tỏa. */
  @Column({ name: 'locked_delta', type: 'int', default: 0 })
  lockedDelta: number;

  @Column({ name: 'quantity_after', type: 'int' })
  quantityAfter: number;

  @Column({ name: 'locked_after', type: 'int', default: 0 })
  lockedAfter: number;

  @Column({ name: 'ref_order_id', type: 'uuid', nullable: true })
  refOrderId: string | null;

  @Column({ name: 'ref_trade_id', type: 'uuid', nullable: true })
  refTradeId: string | null;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => TradingAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trading_account_id' })
  tradingAccount: TradingAccount;

  @ManyToOne(() => Stock)
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
}
