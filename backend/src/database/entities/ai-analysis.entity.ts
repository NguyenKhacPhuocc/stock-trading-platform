import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Stock } from './stock.entity';

@Entity('ai_analyses')
@Index(['stockId', 'createdAt'])
export class AIAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stock_id', type: 'uuid' })
  stockId: string;

  /** "bullish" | "bearish" | "sideways" */
  @Column({ length: 32 })
  signal: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  confidence: number;

  /** Chứa SMA, EMA, RSI, MACD */
  @Column({ type: 'jsonb' })
  indicators: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Stock, (s) => s.aiAnalyses)
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
}
