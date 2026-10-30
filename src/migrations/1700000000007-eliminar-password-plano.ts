import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elimina el almacenamiento de contraseñas en texto plano e invalida las
 * sesiones emitidas antes de este cambio mediante `token_version`.
 *
 * La columna `password_plano` es irreversible: no se restaura en `down` para no
 * volver a exponer credenciales.
 */
export class EliminarPasswordPlanoYRevocarSesiones1700000000007 implements MigrationInterface {
  name = 'EliminarPasswordPlanoYRevocarSesiones1700000000007';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0`);
    await q.query(`UPDATE "usuarios" SET "token_version" = "token_version" + 1`);
    await q.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "password_plano"`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "token_version"`);
  }
}
