import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Asignatura } from './asignatura.entity';

@Entity('grupos_asignaturas')
@Index('idx_grupos_asig_asignatura', ['asignaturaId'])
@Index('idx_grupos_asig_activo', ['activo'])
export class GrupoAsignatura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asignatura_id' })
  asignaturaId: string;

  @Column({ name: 'profesor' })
  profesor: string;

  @Column({ name: 'codigo_grupo' })
  codigoGrupo: string;

  @Column({ name: 'horario' })
  horario: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Asignatura, (a) => a.grupos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asignatura_id', foreignKeyConstraintName: 'grupos_asignaturas_asignatura_id_fkey' })
  asignatura: Asignatura;
}
