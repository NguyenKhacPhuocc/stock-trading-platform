import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import {
  MarketSnapshotSource,
  MarketSnapshotIngestStatus,
} from '../../common/const';

/**
 * Mỗi lần chạy đồng bộ snapshot tham chiếu (SSI, …).
 * Cùng `trading_date` có thể có nhiều dòng khi retry; rule skip: tồn tại `SUCCESS` cho ngày đó.
 */
@Entity('market_snapshot_ingests')
@Index(['tradingDate', 'status'])
export class MarketSnapshotIngest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trading_date', type: 'date' })
  @Index()
  tradingDate: string;

  @Column({
    type: 'enum',
    enum: MarketSnapshotSource,
    default: MarketSnapshotSource.SSI,
  })
  source: MarketSnapshotSource;

  @Column({
    type: 'enum',
    enum: MarketSnapshotIngestStatus,
    default: MarketSnapshotIngestStatus.PENDING,
  })
  status: MarketSnapshotIngestStatus;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'symbols_upserted', type: 'int', nullable: true })
  symbolsUpserted: number | null;
}
