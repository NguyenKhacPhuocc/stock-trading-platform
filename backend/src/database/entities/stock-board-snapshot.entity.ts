import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Stock } from './stock.entity';

/**
 * Snapshot bảng giá theo ngày giao dịch — một dòng / mã / ngày.
 * API instruments đọc từ đây; cập nhật khi lệnh thay đổi & khi có khớp (trade).
 */
@Entity('stock_board_snapshots')
@Unique(['stockId', 'tradingDate'])
@Index(['tradingDate'])
export class StockBoardSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stock_id', type: 'uuid' })
  @Index()
  stockId: string;

  /** YYYY-MM-DD — ngày phiên (theo calendar server) */
  @Column({ name: 'trading_date', type: 'date' })
  tradingDate: string;

  @Column({
    name: 'reference_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  referencePrice: number;

  @Column({
    name: 'ceiling_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  ceilingPrice: number;

  @Column({
    name: 'floor_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  floorPrice: number;

  @Column({
    name: 'open_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  openPrice: number;

  @Column({
    name: 'high_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  highPrice: number;

  @Column({
    name: 'low_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  lowPrice: number;

  @Column({
    name: 'last_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  lastPrice: number;

  @Column({ name: 'last_volume', type: 'int', default: 0 })
  lastVolume: number;

  @Column({ name: 'total_volume', type: 'int', default: 0 })
  totalVolume: number;

  @Column({
    name: 'total_value',
    type: 'numeric',
    precision: 20,
    scale: 2,
    default: 0,
  })
  totalValue: number;

  @Column({
    name: 'bid_price_1',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  bidPrice1: number;

  @Column({
    name: 'bid_price_2',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  bidPrice2: number;

  @Column({
    name: 'bid_price_3',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  bidPrice3: number;

  @Column({ name: 'bid_vol_1', type: 'int', default: 0 })
  bidVol1: number;

  @Column({ name: 'bid_vol_2', type: 'int', default: 0 })
  bidVol2: number;

  @Column({ name: 'bid_vol_3', type: 'int', default: 0 })
  bidVol3: number;

  @Column({
    name: 'offer_price_1',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  offerPrice1: number;

  @Column({
    name: 'offer_price_2',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  offerPrice2: number;

  @Column({
    name: 'offer_price_3',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  offerPrice3: number;

  @Column({ name: 'offer_vol_1', type: 'int', default: 0 })
  offerVol1: number;

  @Column({ name: 'offer_vol_2', type: 'int', default: 0 })
  offerVol2: number;

  @Column({ name: 'offer_vol_3', type: 'int', default: 0 })
  offerVol3: number;

  @Column({ name: 'total_bid_qty', type: 'int', default: 0 })
  totalBidQty: number;

  @Column({ name: 'total_offer_qty', type: 'int', default: 0 })
  totalOfferQty: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
}
