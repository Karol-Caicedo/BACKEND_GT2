import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Capacitacion } from './capacitacion.entity';
import { User } from '../users/user.entity';

@Entity('clics_capacitacion')
@Index('idx_clic_cap', ['capacitacionId'])
@Index('idx_clic_user', ['usuarioId'])
export class ClicCapacitacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'capacitacion_id' })
  capacitacionId: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Capacitacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'capacitacion_id', foreignKeyConstraintName: 'clics_capacitacion_capacitacion_id_fkey' })
  capacitacion: Capacitacion;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'clics_capacitacion_usuario_id_fkey' })
  usuario: User;
}
