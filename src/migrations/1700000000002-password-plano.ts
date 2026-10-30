import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordPlano1700000000002 implements MigrationInterface {
  name = 'PasswordPlano1700000000002';

  /**
   * Migración histórica neutralizada. La versión original agregaba una columna
   * con contraseñas en claro y valores por defecto conocidos. La columna se
   * elimina de forma definitiva en `EliminarPasswordPlanoYRevocarSesiones`.
   */
  async up(_q: QueryRunner): Promise<void> {
    // No-op intencional.
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "password_plano"`);
  }
}
