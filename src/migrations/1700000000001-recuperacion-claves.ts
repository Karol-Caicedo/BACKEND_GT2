import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecuperacionClaves1700000000001 implements MigrationInterface {
  name = 'RecuperacionClaves1700000000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "recuperacion_claves" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
      "token_hash" varchar NOT NULL UNIQUE,
      "expira_at" timestamptz NOT NULL,
      "usado_at" timestamptz NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX "idx_recclave_token" ON "recuperacion_claves" ("token_hash")`);
    await q.query(`CREATE INDEX "idx_recclave_usuario" ON "recuperacion_claves" ("usuario_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "recuperacion_claves" CASCADE`);
  }
}
