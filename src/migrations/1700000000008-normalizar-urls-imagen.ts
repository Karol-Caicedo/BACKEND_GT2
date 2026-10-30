import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizarUrlsImagen1700000000008 implements MigrationInterface {
  name = 'NormalizarUrlsImagen1700000000008';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE "capacitaciones"
      SET "imagen_url" = '/api/uploads/' || substring("imagen_url" from 10)
      WHERE "imagen_url" LIKE '/uploads/%'
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE "capacitaciones"
      SET "imagen_url" = '/uploads/' || substring("imagen_url" from 14)
      WHERE "imagen_url" LIKE '/api/uploads/%'
    `);
  }
}
