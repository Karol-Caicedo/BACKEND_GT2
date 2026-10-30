import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, OneToMany } from 'typeorm';
import { GrupoAsignatura } from './grupo-asignatura.entity';

@Entity('asignaturas')
@Index('idx_asignaturas_semestre', ['semestre'])
@Index('idx_asignaturas_activo', ['activo'])
export class Asignatura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  codigo?: string;

  @Column({ type: 'int' })
  semestre: number;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => GrupoAsignatura, (g) => g.asignatura)
  grupos: GrupoAsignatura[];
}

