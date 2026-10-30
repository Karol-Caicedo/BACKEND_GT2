import { ConfigService } from '@nestjs/config';

/**
 * Las migraciones pendientes se aplican al inicializar TypeORM en cualquier
 * entorno, incluido producción, para que el despliegue no dependa de un comando
 * de arranque externo. `DB_MIGRATIONS_RUN=false` desactiva la ejecución
 * automática (por ejemplo, para aplicar migraciones de forma manual y revisada).
 */
export function migracionesAutomaticasHabilitadas(config: ConfigService): boolean {
  return (config.get<string>('DB_MIGRATIONS_RUN') || 'true').trim().toLowerCase() !== 'false';
}

export function confirmarMigracion(valor: string | undefined): void {
  if ((valor || '').trim().toUpperCase() !== 'YES') {
    throw new Error(
      'Migraciones bloqueadas. Revisa las migraciones pendientes y ejecuta con MIGRATE_CONFIRM=YES.',
    );
  }
}
