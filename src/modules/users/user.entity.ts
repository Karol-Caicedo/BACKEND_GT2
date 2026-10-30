import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type Rol = 'ESTUDIANTE' | 'ADMIN';

@Entity('usuarios')
@Index('idx_usuarios_semestre', ['semestre'])
@Index('idx_usuarios_rol', ['rol'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index('idx_usuarios_correo')
  correo: string;

  @Column()
  nombre: string;

  @Column({ name: 'numero_identificacion', nullable: true, type: 'varchar' })
  @Index('idx_usuarios_numero_identificacion')
  numeroIdentificacion: string | null;

  @Column({ name: 'password_hash', nullable: true, type: 'varchar' })
  passwordHash: string | null;

  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion: number;

  @Column({ name: 'proveedor_auth', default: 'local' })
  proveedorAuth: string;

  @Column({ type: 'int' })
  semestre: number;

  @Column({ type: 'varchar', default: 'ESTUDIANTE' })
  rol: Rol;

  @Column({ name: 'acepto_datos_at', type: 'timestamptz', nullable: true })
  aceptoDatosAt: Date | null;

  @Column({ name: 'proveedor_id', nullable: true, type: 'varchar' })
  proveedorId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
