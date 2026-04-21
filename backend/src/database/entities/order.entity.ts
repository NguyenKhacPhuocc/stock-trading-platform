import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TradingAccount } from './trading-account.entity';
import { Stock } from './stock.entity';
import { Trade } from './trade.entity';
import { OrderSide, OrderType, OrderStatus } from '../../common/const';

@Entity('orders')
@Index(['stockId', 'status', 'createdAt'])
@Index(['tradingAccountId', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trading_account_id', type: 'uuid' })
  tradingAccountId: string;

  @Column({ name: 'stock_id', type: 'uuid' })
  stockId: string;

  @Column({ type: 'enum', enum: OrderSide })
  side: OrderSide;

  @Column({ name: 'order_type', type: 'enum', enum: OrderType })
  orderType: OrderType;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  price: number | null;

  @Column()
  quantity: number;

  @Column({ name: 'matched_qty', default: 0 })
  matchedQty: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({
    name: 'cancelled_at',
    type: 'timestamptz',
    nullable: true,
  })
  cancelledAt: Date | null;

  @Column({ name: 'rejected_reason', nullable: true, type: 'text' })
  rejectedReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => TradingAccount, (ta) => ta.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trading_account_id' })
  tradingAccount: TradingAccount;

  @ManyToOne(() => Stock, (s) => s.orders)
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;

  @OneToMany(() => Trade, (t) => t.buyOrder)
  buyTrades: Trade[];

  @OneToMany(() => Trade, (t) => t.sellOrder)
  sellTrades: Trade[];
}
