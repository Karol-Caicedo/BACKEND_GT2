import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('login_crypto_challenges')
@Index('idx_login_crypto_challenges_expira', ['expiraAt'])
export class LoginChallenge {
  @PrimaryColumn({ name: 'challenge_hash', type: 'char', length: 64 })
  challengeHash: string;

  @Column({ name: 'key_id', type: 'varchar', length: 64 })
  keyId: string;

  @Column({ name: 'expira_at', type: 'timestamptz' })
  expiraAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
