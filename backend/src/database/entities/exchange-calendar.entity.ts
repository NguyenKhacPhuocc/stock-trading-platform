import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { TradingSession } from '../../common/const';

@Entity('exchange_calendar')
export class ExchangeCalendar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', unique: true })
  @Index()
  date: string;

  @Column({ name: 'is_trading_day', default: true })
  isTradingDay: boolean;

  @Column({
    type: 'enum',
    enum: TradingSession,
    default: TradingSession.ALL_DAY,
  })
  session: TradingSession;

  @Column({ nullable: true, type: 'text' })
  note: string | null;
}
