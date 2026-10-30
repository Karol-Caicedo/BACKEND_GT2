import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PeriodoActivoUnico1700000000010 implements MigrationInterface {
  name = 'PeriodoActivoUnico1700000000010';

  async up(q: QueryRunner): Promise<void> {
    const filas = await q.query(`SELECT COUNT(*)::int AS total FROM "periodos" WHERE "activo" = true`);
    const total = Number(filas[0]?.total ?? 0);
    if (total > 1) {
      throw new Error(`No se puede crear uq_periodo_activo: existen ${total} periodos activos. Deja uno solo antes de migrar.`);
    }
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_periodo_activo" ON "periodos" ("activo") WHERE "activo" = true`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "uq_periodo_activo"`);
  }
}
