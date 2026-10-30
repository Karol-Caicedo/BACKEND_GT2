import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await q.query(`CREATE TABLE "usuarios" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "correo" varchar NOT NULL UNIQUE,
      "nombre" varchar NOT NULL,
      "password_hash" varchar NULL,
      "proveedor_auth" varchar NOT NULL DEFAULT 'local',
      "proveedor_id" varchar NULL,
      "semestre" int NOT NULL,
      "rol" varchar NOT NULL DEFAULT 'ESTUDIANTE',
      "acepto_datos_at" timestamptz NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_usuarios_correo" ON "usuarios" ("correo")`);
    await q.query(`CREATE INDEX "idx_usuarios_semestre" ON "usuarios" ("semestre")`);
    await q.query(`CREATE INDEX "idx_usuarios_rol" ON "usuarios" ("rol")`);
    await q.query(`CREATE TABLE "periodos" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "nombre" varchar NOT NULL UNIQUE,
      "fecha_inicio" date NOT NULL,
      "fecha_fin" date NOT NULL,
      "activo" boolean NOT NULL DEFAULT false,
      "modo_encuesta" varchar NOT NULL DEFAULT 'seleccion'
    )`);
    await q.query(`CREATE TABLE "temas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "nombre" varchar NOT NULL UNIQUE,
      "descripcion" text NULL,
      "activo" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_temas_nombre" ON "temas" ("nombre")`);
    await q.query(`CREATE INDEX "idx_temas_activo" ON "temas" ("activo")`);
    await q.query(`CREATE TABLE "respuestas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
      "periodo_id" uuid NOT NULL REFERENCES "periodos"("id") ON DELETE CASCADE,
      "semestre_al_responder" int NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_respuesta_usuario_periodo" UNIQUE ("usuario_id","periodo_id")
    )`);
    await q.query(`CREATE INDEX "idx_respuestas_periodo" ON "respuestas" ("periodo_id")`);
    await q.query(`CREATE INDEX "idx_respuestas_semestre" ON "respuestas" ("semestre_al_responder")`);
    await q.query(`CREATE TABLE "respuesta_temas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "respuesta_id" uuid NOT NULL REFERENCES "respuestas"("id") ON DELETE CASCADE,
      "tema_id" uuid NOT NULL REFERENCES "temas"("id") ON DELETE CASCADE,
      "puntaje" int NULL
    )`);
    await q.query(`CREATE INDEX "idx_rt_tema" ON "respuesta_temas" ("tema_id")`);
    await q.query(`CREATE TABLE "sugerencias" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "respuesta_id" uuid NOT NULL REFERENCES "respuestas"("id") ON DELETE CASCADE,
      "texto" text NOT NULL,
      "estado" varchar NOT NULL DEFAULT 'nueva',
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_sugerencias_estado" ON "sugerencias" ("estado")`);
    await q.query(`CREATE TABLE "capacitaciones" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "titulo" varchar NOT NULL,
      "descripcion" text NOT NULL,
      "enlace" varchar NOT NULL,
      "imagen_url" varchar NULL,
      "tema_id" uuid NULL REFERENCES "temas"("id") ON DELETE SET NULL,
      "fecha_evento" timestamptz NULL,
      "modalidad" varchar NOT NULL DEFAULT 'virtual',
      "visible_desde" timestamptz NULL,
      "visible_hasta" timestamptz NULL,
      "estado" varchar NOT NULL DEFAULT 'borrador',
      "created_by" uuid NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_cap_estado" ON "capacitaciones" ("estado")`);
    await q.query(`CREATE INDEX "idx_cap_tema" ON "capacitaciones" ("tema_id")`);
    await q.query(`CREATE TABLE "capacitacion_semestres" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "capacitacion_id" uuid NOT NULL REFERENCES "capacitaciones"("id") ON DELETE CASCADE,
      "semestre" int NOT NULL
    )`);
    await q.query(`CREATE INDEX "idx_cap_sem_semestre" ON "capacitacion_semestres" ("semestre")`);
    await q.query(`CREATE TABLE "clics_capacitacion" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "capacitacion_id" uuid NOT NULL REFERENCES "capacitaciones"("id") ON DELETE CASCADE,
      "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_clic_cap" ON "clics_capacitacion" ("capacitacion_id")`);
    await q.query(`CREATE INDEX "idx_clic_user" ON "clics_capacitacion" ("usuario_id")`);
    await q.query(`CREATE TABLE "recordatorios_enviados" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
      "periodo_id" uuid NOT NULL REFERENCES "periodos"("id") ON DELETE CASCADE,
      "numero" int NOT NULL,
      "enviado_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_rec_user_periodo" ON "recordatorios_enviados" ("usuario_id","periodo_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of ['recordatorios_enviados','clics_capacitacion','capacitacion_semestres','capacitaciones','sugerencias','respuesta_temas','respuestas','temas','periodos','usuarios'])
      await q.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
  }
}
