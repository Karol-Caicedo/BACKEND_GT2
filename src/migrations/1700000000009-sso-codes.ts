import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SsoCodes1700000000009 implements MigrationInterface {
  name = 'SsoCodes1700000000009';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "sso_codes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "codigo_hash" char(64) NOT NULL,
        "usuario_id" uuid NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
        "datos" jsonb NULL,
        "expira_at" timestamptz NOT NULL,
        "usado_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_sso_codes_hash" ON "sso_codes" ("codigo_hash")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sso_codes_expira" ON "sso_codes" ("expira_at")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS "sso_codes"');
  }
}
