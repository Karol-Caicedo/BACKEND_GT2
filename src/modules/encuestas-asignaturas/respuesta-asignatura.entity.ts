import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Unique, Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Periodo } from '../periodos/periodo.entity';
import { Asignatura } from '../asignaturas/asignatura.entity';
import { GrupoAsignatura } from '../asignaturas/grupo-asignatura.entity';

@Entity('respuestas_asignaturas')
@Unique('uq_respuesta_asig_usuario_periodo', ['usuarioId', 'periodoId'])
@Index('idx_respuestas_asig_periodo', ['periodoId'])
@Index('idx_respuestas_asig_semestre', ['semestreAlResponder'])
export class RespuestaAsignatura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @Column({ name: 'periodo_id' })
  periodoId: string;

  @Column({ name: 'semestre_al_responder', type: 'int' })
  semestreAlResponder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'respuestas_asignaturas_usuario_id_fkey' })
  usuario: User;

  @ManyToOne(() => Periodo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'periodo_id', foreignKeyConstraintName: 'respuestas_asignaturas_periodo_id_fkey' })
  periodo: Periodo;

  @OneToMany(() => RespuestaAsignaturaItem, (item) => item.respuestaAsignatura, { cascade: true })
  items: RespuestaAsignaturaItem[];
}

@Entity('respuesta_asignatura_items')
@Index('idx_rai_asignatura', ['asignaturaId'])
@Index('idx_rai_resp_asig', ['respuestaAsignaturaId'])
@Index('idx_rai_grupo', ['grupoId'])
export class RespuestaAsignaturaItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'respuesta_asignatura_id' })
  respuestaAsignaturaId: string;

  @Column({ name: 'asignatura_id' })
  asignaturaId: string;

  @Column({ name: 'grupo_id', type: 'uuid', nullable: true })
  grupoId?: string | null;

  @Column({ name: 'tiene_dificultad', default: false })
  tieneDificultad: boolean;

  @Column({ name: 'nivel_satisfaccion', type: 'int' })
  nivelSatisfaccion: number;

  @ManyToOne(() => RespuestaAsignatura, (ra) => ra.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'respuesta_asignatura_id', foreignKeyConstraintName: 'respuesta_asignatura_items_respuesta_asignatura_id_fkey' })
  respuestaAsignatura: RespuestaAsignatura;

  @ManyToOne(() => Asignatura, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asignatura_id', foreignKeyConstraintName: 'respuesta_asignatura_items_asignatura_id_fkey' })
  asignatura: Asignatura;

  @ManyToOne(() => GrupoAsignatura, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'grupo_id', foreignKeyConstraintName: 'respuesta_asignatura_items_grupo_id_fkey' })
  grupo?: GrupoAsignatura | null;
}

