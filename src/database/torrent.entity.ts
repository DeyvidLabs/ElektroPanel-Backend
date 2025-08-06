import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('torrents')
export class Torrent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  size: string;

  @CreateDateColumn()
  addedAt: Date;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn({ name: 'userId' }) // specifica il nome della colonna FK
  user: User;
}
