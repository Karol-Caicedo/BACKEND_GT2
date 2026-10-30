import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResetRespuestas1700000000005 implements MigrationInterface {
  /**
   * Migración histórica neutralizada. Su versión original ejecutaba TRUNCATE
   * sobre respuestas y podía borrar datos al aplicar migraciones pendientes en
   * producción. No se debe reintroducir borrado destructivo en una migración.
   */
  public async up(_q: QueryRunner): Promise<void> {
    // No-op intencional.
  }

  public async down(_q: QueryRunner): Promise<void> {
    // No-op
  }
}
