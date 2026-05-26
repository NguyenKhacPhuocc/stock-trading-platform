import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { TransactionType } from '../../common/const';

/** Sổ nhật ký tiền — append-only, không sửa dòng cũ */
@Entity('cash_transactions')
@Index(['walletId', 'createdAt'])
export class CashTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  /** Số dương = cộng vào ví; số âm = trừ khỏi ví */
  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount: number;

  /** Số dư khả dụng sau bút toán. */
  @Column({
    name: 'available_after',
    type: 'numeric',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  availableAfter: number | null;

  /** Tổng tiền (khả dụng + phong tỏa) sau bút toán. */
  @Column({ name: 'balance_after', type: 'numeric', precision: 20, scale: 2 })
  balanceAfter: number;

  @Column({ name: 'ref_order_id', type: 'uuid', nullable: true })
  refOrderId: string | null;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Wallet, (w) => w.transactions)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}
