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
import { MarketSnapshotSource } from '../../common/const';

/**
 * Snapshot bảng giá theo ngày giao dịch — một dòng / mã / ngày.
 * Đầu ngày: seed từ SSI (TC/trần/sàn, metadata tham chiếu).
 * Trong phiên: engine mô phỏng có thể cập nhật depth/khớp nội bộ vào cùng snapshot
 * để người dùng theo dõi một dòng dữ liệu liên tục trong hệ thống.
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

  /** varchar để tránh trùng enum PG với `market_snapshot_ingests.source` */
  @Column({
    name: 'ingest_source',
    type: 'varchar',
    length: 32,
    default: MarketSnapshotSource.SSI,
  })
  ingestSource: MarketSnapshotSource;

  @Column({ name: 'ingested_at', type: 'timestamptz', nullable: true })
  ingestedAt: Date | null;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Column({ name: 'session_code', type: 'varchar', length: 32, nullable: true })
  sessionCode: string | null;

  @Column({
    name: 'price_change',
    type: 'numeric',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  priceChange: number | null;

  @Column({
    name: 'price_change_pct',
    type: 'numeric',
    precision: 12,
    scale: 6,
    nullable: true,
  })
  priceChangePct: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
}
