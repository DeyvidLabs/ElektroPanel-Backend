import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity()
@Index(['fileName', 'inode'], { unique: true })
export class LogFileState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'bigint' })
  inode: number;

  @Column({ type: 'bigint', default: 0 })
  lastReadPosition: number;

  @Column({ type: 'datetime' })
  lastModified: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  lastChecked: Date;
}