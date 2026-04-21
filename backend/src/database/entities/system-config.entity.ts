import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('system_configs')
export class SystemConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 128 })
  @Index()
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
