import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// @Entity('mail.users')
export class MailUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'bigint', default: 104857600 })
  quota: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recoveryEmail: string;
}
