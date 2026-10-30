import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { User } from '../users/user.entity';

/** Tokens de un solo uso para recuperación de contraseña (se guarda solo el hash). */
@Entity('recuperacion_claves')
@Index('idx_recclave_token', ['tokenHash'], { unique: true })
@Index('idx_recclave_usuario', ['usuarioId'])
export class PasswordReset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @Column({ name: 'token_hash', unique: true })
  tokenHash: string;

  @Column({ name: 'expira_at', type: 'timestamptz' })
  expiraAt: Date;

  @Column({ name: 'usado_at', type: 'timestamptz', nullable: true })
  usadoAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'recuperacion_claves_usuario_id_fkey' })
  usuario: User;
}
