import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { TradingAccount } from './trading-account.entity';
import { Stock } from './stock.entity';

/** Danh mục nắm giữ — mỗi mã CK trong 1 TKCK là 1 dòng */
@Entity('positions')
@Unique(['tradingAccountId', 'stockId'])
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trading_account_id', type: 'uuid' })
  tradingAccountId: string;

  @Column({ name: 'stock_id', type: 'uuid' })
  stockId: string;

  /** Khối lượng khả dụng (chưa phong tỏa lệnh bán) — tương tự available_balance */
  @Column({ default: 0 })
  quantity: number;

  /** Khối lượng phong tỏa khi đặt lệnh bán chờ khớp — tương tự locked_balance */
  @Column({ name: 'locked_quantity', default: 0 })
  lockedQuantity: number;

  /**
   * Giá vốn bình quân gia quyền (WAC). Khi mua nhiều lần / bán một phần, engine khớp phải cập nhật đúng công thức — sai là PnL sai.
   */
  @Column({
    name: 'avg_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  avgPrice: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => TradingAccount, (ta) => ta.positions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trading_account_id' })
  tradingAccount: TradingAccount;

  @ManyToOne(() => Stock, (s) => s.positions)
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
}
