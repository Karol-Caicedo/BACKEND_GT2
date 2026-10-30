import type { MigrationInterface, QueryRunner } from 'typeorm';

export class GruposAsignaturas1700000000012 implements MigrationInterface {
  name = 'GruposAsignaturas1700000000012';

  async up(q: QueryRunner): Promise<void> {
    // 1. Tabla grupos_asignaturas
    await q.query(`CREATE TABLE IF NOT EXISTS "grupos_asignaturas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "asignatura_id" uuid NOT NULL REFERENCES "asignaturas"("id") ON DELETE CASCADE,
      "profesor" varchar NOT NULL,
      "codigo_grupo" varchar NOT NULL,
      "horario" varchar NOT NULL,
      "activo" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE INDEX IF NOT EXISTS "idx_grupos_asig_asignatura" ON "grupos_asignaturas" ("asignatura_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_grupos_asig_activo" ON "grupos_asignaturas" ("activo")`);

    // 2. Columna grupo_id en inscripciones_asignaturas
    await q.query(`ALTER TABLE "inscripciones_asignaturas" ADD COLUMN IF NOT EXISTS "grupo_id" uuid NULL REFERENCES "grupos_asignaturas"("id") ON DELETE SET NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_inscripcion_grupo" ON "inscripciones_asignaturas" ("grupo_id")`);

    // 3. Columna grupo_id en respuesta_asignatura_items
    await q.query(`ALTER TABLE "respuesta_asignatura_items" ADD COLUMN IF NOT EXISTS "grupo_id" uuid NULL REFERENCES "grupos_asignaturas"("id") ON DELETE SET NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_rai_grupo" ON "respuesta_asignatura_items" ("grupo_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_rai_grupo"`);
    await q.query(`ALTER TABLE "respuesta_asignatura_items" DROP COLUMN IF EXISTS "grupo_id"`);
    await q.query(`DROP INDEX IF EXISTS "idx_inscripcion_grupo"`);
    await q.query(`ALTER TABLE "inscripciones_asignaturas" DROP COLUMN IF EXISTS "grupo_id"`);
    await q.query(`DROP TABLE IF EXISTS "grupos_asignaturas"`);
  }
}
