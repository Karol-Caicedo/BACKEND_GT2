import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Elimina la funcionalidad de sugerencias de temas propuesta por estudiantes. */
export class DropSugerencias1700000000003 implements MigrationInterface {
  name = 'DropSugerencias1700000000003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "sugerencias"`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "sugerencias" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "respuesta_id" uuid NOT NULL REFERENCES "respuestas"("id") ON DELETE CASCADE,
      "texto" text NOT NULL,
      "estado" varchar NOT NULL DEFAULT 'nueva',
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sugerencias_estado" ON "sugerencias" ("estado")`);
  }
}
