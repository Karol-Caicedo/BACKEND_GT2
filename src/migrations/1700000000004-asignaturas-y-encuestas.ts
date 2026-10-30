import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AsignaturasYEncuestas1700000000004 implements MigrationInterface {
  name = 'AsignaturasYEncuestas1700000000004';

  async up(q: QueryRunner): Promise<void> {
    // 1. Campo numero_identificacion en usuarios
    await q.query(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "numero_identificacion" varchar NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_usuarios_numero_identificacion" ON "usuarios" ("numero_identificacion")`);

    // 2. Control de activación de encuesta de asignaturas en periodos
    await q.query(`ALTER TABLE "periodos" ADD COLUMN IF NOT EXISTS "encuesta_asignaturas_activa" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "periodos" ADD COLUMN IF NOT EXISTS "fecha_inicio_asignaturas" date NULL`);
    await q.query(`ALTER TABLE "periodos" ADD COLUMN IF NOT EXISTS "fecha_fin_asignaturas" date NULL`);

    // 3. Tabla asignaturas
    await q.query(`CREATE TABLE IF NOT EXISTS "asignaturas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "nombre" varchar NOT NULL,
      "semestre" int NOT NULL,
      "activo" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_asignaturas_semestre" ON "asignaturas" ("semestre")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_asignaturas_activo" ON "asignaturas" ("activo")`);

    // 4. Tabla respuestas_asignaturas
    await q.query(`CREATE TABLE IF NOT EXISTS "respuestas_asignaturas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
      "periodo_id" uuid NOT NULL REFERENCES "periodos"("id") ON DELETE CASCADE,
      "semestre_al_responder" int NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_respuesta_asig_usuario_periodo" UNIQUE ("usuario_id", "periodo_id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_respuestas_asig_periodo" ON "respuestas_asignaturas" ("periodo_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_respuestas_asig_semestre" ON "respuestas_asignaturas" ("semestre_al_responder")`);

    // 5. Tabla respuesta_asignatura_items
    await q.query(`CREATE TABLE IF NOT EXISTS "respuesta_asignatura_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "respuesta_asignatura_id" uuid NOT NULL REFERENCES "respuestas_asignaturas"("id") ON DELETE CASCADE,
      "asignatura_id" uuid NOT NULL REFERENCES "asignaturas"("id") ON DELETE CASCADE,
      "tiene_dificultad" boolean NOT NULL DEFAULT false,
      "nivel_satisfaccion" int NOT NULL
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_rai_asignatura" ON "respuesta_asignatura_items" ("asignatura_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_rai_resp_asig" ON "respuesta_asignatura_items" ("respuesta_asignatura_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "respuesta_asignatura_items"`);
    await q.query(`DROP TABLE IF EXISTS "respuestas_asignaturas"`);
    await q.query(`DROP TABLE IF EXISTS "asignaturas"`);
    await q.query(`ALTER TABLE "periodos" DROP COLUMN IF EXISTS "fecha_fin_asignaturas"`);
    await q.query(`ALTER TABLE "periodos" DROP COLUMN IF EXISTS "fecha_inicio_asignaturas"`);
    await q.query(`ALTER TABLE "periodos" DROP COLUMN IF EXISTS "encuesta_asignaturas_activa"`);
    await q.query(`DROP INDEX IF EXISTS "idx_usuarios_numero_identificacion"`);
    await q.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "numero_identificacion"`);
  }
}
