import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn } from 'typeorm';

@Entity()
@Index('IDX_UNIQUE_EVENT', ['ipAddress'], { unique: true })
export class ConnectionEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ipAddress: string;

  @Column({ type: 'bigint', default: 1 })
  amount: number;

  @Column({ type: 'boolean', nullable: true })
  blacklisted: boolean;

  @Column({ type: 'varchar', nullable: true })
  isp: string;

  @Column({ type: 'varchar', nullable: true })
  org: string;

  @Column({ type: 'varchar', nullable: true })
  country: string;

  @Column({ type: 'datetime', nullable: true })
  ipInfoLastUpdated: Date;

  @Column({ type: 'datetime' })
  lastTimestamp: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  updatedAt: Date;
}
