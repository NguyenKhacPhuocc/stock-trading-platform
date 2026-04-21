import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { KycStatus } from '../../common/const';

/**
 * Hồ sơ KYC của khách hàng.
 * Thực tế: chụp ảnh CCCD, xác minh sinh trắc học.
 * Đồ án: nhập số CCCD bất kỳ → hệ thống tự set simulated_verified.
 */
@Entity('customer_profiles')
export class CustomerProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Số CCCD / CMND — người dùng nhập bất kỳ để mô phỏng KYC */
  @Column({
    name: 'national_id_number',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  nationalIdNumber: string | null;

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  kycStatus: KycStatus;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  // nơi khách hàng nhận thư từ của các công ty chứng khoán
  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => User, (u: User) => u.customerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
