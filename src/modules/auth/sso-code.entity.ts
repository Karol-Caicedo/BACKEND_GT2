import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('sso_codes')
@Index('idx_sso_codes_hash', ['codigoHash'], { unique: true })
@Index('idx_sso_codes_expira', ['expiraAt'])
export class SsoCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'codigo_hash', type: 'char', length: 64 })
  codigoHash: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'sso_codes_usuario_id_fkey' })
  usuario: User | null;

  @Column({ type: 'jsonb', nullable: true })
  datos: Record<string, unknown> | null;

  @Column({ name: 'expira_at', type: 'timestamptz' })
  expiraAt: Date;

  @Column({ name: 'usado_at', type: 'timestamptz', nullable: true })
  usadoAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
