import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/** Audit trail hệ thống (bắt buộc cho tài chính — ghi ai/sửa gì/khi nào) */
@Entity('audit_logs')
@Index(['entityType', 'entityId', 'createdAt'])
@Index(['actorUserId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ length: 128 })
  action: string;

  @Column({ name: 'entity_type', length: 64 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ name: 'payload_before', type: 'jsonb', nullable: true })
  payloadBefore: Record<string, unknown> | null;

  @Column({ name: 'payload_after', type: 'jsonb', nullable: true })
  payloadAfter: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
