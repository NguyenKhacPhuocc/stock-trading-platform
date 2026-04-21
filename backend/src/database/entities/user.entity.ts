import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { CustomerProfile } from './customer-profile.entity';
import { TradingAccount } from './trading-account.entity';
import { Watchlist } from './watchlist.entity';
import { Notification } from './notification.entity';
import { UserRole } from '../../common/const';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * CustId — mã khách hàng (không phải số tiểu khoản `.1` / `.5`).
   * Tiểu khoản nằm ở `trading_accounts.account_id` = `{custId}.{suffix}`.
   */
  @Column({ name: 'cust_id', unique: true, length: 32 })
  @Index()
  custId: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'full_name', length: 128 })
  fullName: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'email', type: 'varchar', length: 256, nullable: true })
  email: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => CustomerProfile, (cp: CustomerProfile) => cp.user, {
    cascade: true,
  })
  customerProfile: CustomerProfile;

  @OneToMany(() => TradingAccount, (ta: TradingAccount) => ta.user)
  tradingAccounts: TradingAccount[];

  @OneToMany(() => Watchlist, (w: Watchlist) => w.user)
  watchlists: Watchlist[];

  @OneToMany(() => Notification, (n: Notification) => n.user)
  notifications: Notification[];
}
