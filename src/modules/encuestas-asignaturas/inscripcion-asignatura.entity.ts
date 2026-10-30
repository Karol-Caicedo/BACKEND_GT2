import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Unique, Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Periodo } from '../periodos/periodo.entity';
import { Asignatura } from '../asignaturas/asignatura.entity';
import { GrupoAsignatura } from '../asignaturas/grupo-asignatura.entity';

@Entity('inscripciones_asignaturas')
@Unique('uq_inscripcion_usuario_periodo_asig', ['usuarioId', 'periodoId', 'asignaturaId'])
@Index('idx_inscripcion_usuario', ['usuarioId'])
@Index('idx_inscripcion_periodo', ['periodoId'])
@Index('idx_inscripcion_asignatura', ['asignaturaId'])
@Index('idx_inscripcion_grupo', ['grupoId'])
export class InscripcionAsignatura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @Column({ name: 'periodo_id' })
  periodoId: string;

  @Column({ name: 'asignatura_id' })
  asignaturaId: string;

  @Column({ name: 'grupo_id', type: 'uuid', nullable: true })
  grupoId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'inscripciones_asignaturas_usuario_id_fkey' })
  usuario: User;

  @ManyToOne(() => Periodo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'periodo_id', foreignKeyConstraintName: 'inscripciones_asignaturas_periodo_id_fkey' })
  periodo: Periodo;

  @ManyToOne(() => Asignatura, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asignatura_id', foreignKeyConstraintName: 'inscripciones_asignaturas_asignatura_id_fkey' })
  asignatura: Asignatura;

  @ManyToOne(() => GrupoAsignatura, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'grupo_id', foreignKeyConstraintName: 'inscripciones_asignaturas_grupo_id_fkey' })
  grupo?: GrupoAsignatura | null;
}

