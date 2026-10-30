import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export type ModoEncuesta = 'seleccion' | 'calificacion';

@Entity('periodos')
@Index('uq_periodo_activo', ['activo'], { unique: true, where: '"activo" = true' })
export class Periodo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  nombre: string;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin: string;

  @Column({ default: false })
  activo: boolean;

  @Column({ name: 'modo_encuesta', default: 'seleccion' })
  modoEncuesta: ModoEncuesta;

  @Column({ name: 'encuesta_asignaturas_activa', default: false })
  encuestaAsignaturasActiva: boolean;

  @Column({ name: 'fecha_inicio_asignaturas', type: 'date', nullable: true })
  fechaInicioAsignaturas: string | null;

  @Column({ name: 'fecha_fin_asignaturas', type: 'date', nullable: true })
  fechaFinAsignaturas: string | null;
}

