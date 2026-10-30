import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LoginCryptoChallenges1700000000011 implements MigrationInterface {
  name = 'LoginCryptoChallenges1700000000011';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "login_crypto_challenges" (
        "challenge_hash" char(64) PRIMARY KEY,
        "key_id" varchar(64) NOT NULL,
        "expira_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_login_crypto_challenges_expira" ON "login_crypto_challenges" ("expira_at")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS "login_crypto_challenges"');
  }
}
