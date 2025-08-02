import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';
import { ActorType, ServiceType, SystemLogDTO } from '../shared/interfaces/systemlog.interface';

@Entity('system_logs')
@Index(['service', 'timestamp'])
@Index(['actorType', 'actorId'])
@Index(['targetType', 'targetId'])
export class SystemLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 50 })
  service: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  // Actor Fields
  @Column({ type: 'varchar', length: 20, name: 'actor_type' })
  actorType: ActorType;

  @Column({ type: 'varchar', length: 100, name: 'actor_id', nullable: true })
  actorId?: string;

  @Column({ type: 'varchar', length: 50, name: 'actor_display_name', nullable: true })
  actorDisplayName?: string;

  @Column({ type: 'varchar', length: 45, name: 'actor_ip', nullable: true })
  actorIp?: string;

  // Target Fields
  @Column({ type: 'varchar', length: 50, name: 'target_type', nullable: true })
  targetType?: string;

  @Column({ type: 'varchar', length: 255, name: 'target_id', nullable: true })
  targetId?: string;

  @Column({ type: 'varchar', length: 255, name: 'target_name', nullable: true })
  targetName?: string;

  // Metadata (stored as JSON)
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  // Convert to DTO for external use
  toJSON(): SystemLogDTO {
    return {
      timestamp: this.timestamp,
      service: this.service as ServiceType,
      action: this.action,
      actor: {
        type: this.actorType,
        id: this.actorId,
        displayName: this.actorDisplayName,
        ip: this.actorIp
      },
      target: this.targetType ? {
        type: this.targetType,
        id: this.targetId!,
        name: this.targetName
      } : undefined,
      metadata: this.metadata
    };
  }
}
