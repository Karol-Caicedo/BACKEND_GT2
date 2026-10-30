import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';
import { Periodo } from '../periodos/periodo.entity';

@Entity('recordatorios_enviados')
@Index('idx_rec_user_periodo', ['usuarioId', 'periodoId'])
export class RecordatorioEnviado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'periodo_id', type: 'uuid' })
  periodoId: string;

  @Column({ type: 'int' })
  numero: number;

  @CreateDateColumn({ name: 'enviado_at', type: 'timestamptz' })
  enviadoAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'recordatorios_enviados_usuario_id_fkey' })
  usuario: User;

  @ManyToOne(() => Periodo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'periodo_id', foreignKeyConstraintName: 'recordatorios_enviados_periodo_id_fkey' })
  periodo: Periodo;
}
