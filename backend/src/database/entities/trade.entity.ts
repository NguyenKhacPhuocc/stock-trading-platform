import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from './order.entity';

/** Bản ghi khớp lệnh — mỗi lần khớp (dù partial) tạo 1 dòng */
@Entity('trades')
@Index(['createdAt'])
@Index(['buyOrderId'])
@Index(['sellOrderId'])
@Index(['stockId', 'createdAt'])
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'buy_order_id', type: 'uuid' })
  buyOrderId: string;

  @Column({ name: 'sell_order_id', type: 'uuid' })
  sellOrderId: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  price: number;

  @Column()
  quantity: number;

  /**
   * Denormalize: luôn = price × quantity. Tầng khớp lệnh phải ghi đúng để tránh lệch báo cáo.
   */
  @Column({ name: 'trade_value', type: 'numeric', precision: 20, scale: 2 })
  tradeValue: number;

  /**
   * Denormalize: stockId từ buyOrder/sellOrder — optimize query lịch sử khớp theo symbol.
   */
  @Column({ name: 'stock_id', type: 'uuid', nullable: true })
  stockId: string | null;

  /** Giá vốn bình quân tại thời điểm khớp (bên bán). */
  @Column({
    name: 'cost_basis_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  costBasisPrice: number | null;

  /** Lãi/lỗ đã thực hiện = (price − cost_basis_price) × quantity. */
  @Column({
    name: 'realized_pnl',
    type: 'numeric',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  realizedPnL: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Order, (o) => o.buyTrades)
  @JoinColumn({ name: 'buy_order_id' })
  buyOrder: Order;

  @ManyToOne(() => Order, (o) => o.sellTrades)
  @JoinColumn({ name: 'sell_order_id' })
  sellOrder: Order;
}
