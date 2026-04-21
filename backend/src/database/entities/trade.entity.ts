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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Order, (o) => o.buyTrades)
  @JoinColumn({ name: 'buy_order_id' })
  buyOrder: Order;

  @ManyToOne(() => Order, (o) => o.sellTrades)
  @JoinColumn({ name: 'sell_order_id' })
  sellOrder: Order;
}
