import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Index, OneToMany,
} from 'typeorm';
import { Tema } from '../temas/tema.entity';
import { User } from '../users/user.entity';

export type Modalidad = 'virtual' | 'presencial';
export type EstadoCap = 'borrador' | 'publicado';

@Entity('capacitaciones')
@Index('idx_cap_estado', ['estado'])
export class Capacitacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titulo: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column()
  enlace: string;

  @Column({ name: 'imagen_url', nullable: true, type: 'varchar' })
  imagenUrl: string | null;

  @Column({ name: 'tema_id', nullable: true, type: 'uuid' })
  @Index('idx_cap_tema')
  temaId: string | null;

  @ManyToOne(() => Tema, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tema_id', foreignKeyConstraintName: 'capacitaciones_tema_id_fkey' })
  tema: Tema | null;

  @Column({ name: 'fecha_evento', type: 'timestamptz', nullable: true })
  fechaEvento: Date | null;

  @Column({ default: 'virtual' })
  modalidad: Modalidad;

  @Column({ name: 'visible_desde', type: 'timestamptz', nullable: true })
  visibleDesde: Date | null;

  @Column({ name: 'visible_hasta', type: 'timestamptz', nullable: true })
  visibleHasta: Date | null;

  @Column({ default: 'borrador' })
  estado: EstadoCap;

  @Column({ name: 'created_by', nullable: true, type: 'uuid' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => CapacitacionSemestre, (s) => s.capacitacion, { cascade: true })
  semestres: CapacitacionSemestre[];
}

@Entity('capacitacion_semestres')
@Index('idx_cap_sem_semestre', ['semestre'])
export class CapacitacionSemestre {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'capacitacion_id' })
  capacitacionId: string;

  @Column({ type: 'int' })
  semestre: number;

  @ManyToOne(() => Capacitacion, (c) => c.semestres, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'capacitacion_id', foreignKeyConstraintName: 'capacitacion_semestres_capacitacion_id_fkey' })
  capacitacion: Capacitacion;
}
