import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity()
@Index(['queueId', 'eventType'])
@Index(['timestamp'])
@Index('IDX_UNIQUE_EVENT', ['queueId', 'timestamp', 'data'], { unique: true })
export class EmailEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  queueId: string;

  @Column({ type: 'datetime' })
  timestamp: Date;

  @Column({ type: 'enum', enum: ['from', 'to', 'connect'] })
  eventType: string;

  @Column({ type: 'varchar', length: 255 })
  data: string;

  @Column({ type: 'text', nullable: true })
  rawLine: string;
}
