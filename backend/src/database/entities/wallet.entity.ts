import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { TradingAccount } from './trading-account.entity';
import { CashTransaction } from './cash-transaction.entity';

/**
 * Snapshot số dư — luôn đồng bộ với ledger trong transaction NestJS.
 * Không cập nhật trực tiếp từ SQL tay; mọi biến động: insert cash_transactions + cập nhật 2 cột này.
 * Invariant: total = available_balance + locked_balance (cash_transactions.balance_after = total sau mỗi bút toán).
 */
@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trading_account_id', type: 'uuid', unique: true })
  tradingAccountId: string;

  /** Tiền có thể dùng đặt lệnh mới / rút */
  @Column({
    name: 'available_balance',
    type: 'numeric',
    precision: 20,
    scale: 2,
    default: 0,
  })
  availableBalance: number;

  /** Tiền đang phong tỏa (vd. chờ khớp lệnh mua) */
  @Column({
    name: 'locked_balance',
    type: 'numeric',
    precision: 20,
    scale: 2,
    default: 0,
  })
  lockedBalance: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => TradingAccount, (ta: TradingAccount) => ta.wallet, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trading_account_id' })
  tradingAccount: TradingAccount;

  @OneToMany(() => CashTransaction, (t: CashTransaction) => t.wallet)
  transactions: CashTransaction[];
}
