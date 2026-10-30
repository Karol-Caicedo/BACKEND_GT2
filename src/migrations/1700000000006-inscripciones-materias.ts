import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InscripcionesMaterias1700000000006 implements MigrationInterface {
  name = 'InscripcionesMaterias1700000000006';

  async up(q: QueryRunner): Promise<void> {
    // 1. Campo opcional codigo en asignaturas (pensum)
    await q.query(`ALTER TABLE "asignaturas" ADD COLUMN IF NOT EXISTS "codigo" varchar(50) NULL`);

    // 2. Tabla inscripciones_asignaturas
    await q.query(`CREATE TABLE IF NOT EXISTS "inscripciones_asignaturas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
      "periodo_id" uuid NOT NULL REFERENCES "periodos"("id") ON DELETE CASCADE,
      "asignatura_id" uuid NOT NULL REFERENCES "asignaturas"("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_inscripcion_usuario_periodo_asig" UNIQUE ("usuario_id", "periodo_id", "asignatura_id")
    )`);

    await q.query(`CREATE INDEX IF NOT EXISTS "idx_inscripcion_usuario" ON "inscripciones_asignaturas" ("usuario_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_inscripcion_periodo" ON "inscripciones_asignaturas" ("periodo_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_inscripcion_asignatura" ON "inscripciones_asignaturas" ("asignatura_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "inscripciones_asignaturas"`);
    await q.query(`ALTER TABLE "asignaturas" DROP COLUMN IF EXISTS "codigo"`);
  }
}
