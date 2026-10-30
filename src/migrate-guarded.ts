import 'reflect-metadata';
import AppDataSource from './data-source';
import { confirmarMigracion } from './config/migration-policy';

async function main() {
  confirmarMigracion(process.env.MIGRATE_CONFIRM);

  await AppDataSource.initialize();
  try {
    const hayPendientes = await AppDataSource.showMigrations();
    if (!hayPendientes) {
      console.log('No hay migraciones pendientes.');
      return;
    }

    console.log('Aplicando migraciones pendientes (confirmación explícita recibida)...');
    const ejecutadas = await AppDataSource.runMigrations();
    console.log(`Migraciones aplicadas: ${ejecutadas.map((m) => m.name).join(', ') || 'ninguna'}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
