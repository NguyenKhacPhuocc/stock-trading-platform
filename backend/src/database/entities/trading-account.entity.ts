import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';
import { Position } from './position.entity';
import { Order } from './order.entity';
import {
  TradingAccountStatus,
  TradingAccountType,
  TradingAccountChannel,
} from '../../common/const';

/**
 * Tiểu khoản giao dịch (TKCK / sub-account).
 * `account_id` = `{custId}.1` (cash mặc định), sau có thể `.5`, `.6`, …
 * Lệnh, ví, position gắn `trading_account_id`, không gắn thẳng users.
 */
@Entity('trading_accounts')
@Index(['userId', 'isDefault'])
export class TradingAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Số tiểu khoản — VD `025C000003.1`; không dùng suffix để suy type/channel. */
  @Column({ name: 'account_id', unique: true, length: 64 })
  accountId: string;

  @Column({
    name: 'account_type',
    type: 'enum',
    enum: TradingAccountType,
    default: TradingAccountType.CASH,
  })
  accountType: TradingAccountType;

  @Column({
    name: 'trading_channel',
    type: 'enum',
    enum: TradingAccountChannel,
    default: TradingAccountChannel.STOCK,
  })
  tradingChannel: TradingAccountChannel;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TradingAccountStatus,
    default: TradingAccountStatus.ACTIVE,
  })
  status: TradingAccountStatus;

  @Column({ name: 'is_default', default: true })
  isDefault: boolean;

  @Column({
    name: 'opened_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  openedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (u: User) => u.tradingAccounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToOne(() => Wallet, 'tradingAccount')
  wallet: Wallet;

  @OneToMany(() => Position, (p: Position) => p.tradingAccount)
  positions: Position[];

  @OneToMany(() => Order, 'tradingAccount')
  orders: Order[];
}
