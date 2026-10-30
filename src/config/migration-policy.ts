import { ConfigService } from '@nestjs/config';

/**
 * La aplicación no ejecuta migraciones al inicializar TypeORM en producción.
 * El comando de inicio de Railway ejecuta antes el runner protegido y confirma
 * explícitamente la operación.
 */
export function migracionesAutomaticasHabilitadas(config: ConfigService): boolean {
  const entorno = (config.get<string>('NODE_ENV') || '').trim().toLowerCase();
  if (entorno === 'production') return false;
  return (config.get<string>('DB_MIGRATIONS_RUN') || 'true').trim().toLowerCase() !== 'false';
}

export function confirmarMigracion(valor: string | undefined): void {
  if ((valor || '').trim().toUpperCase() !== 'YES') {
    throw new Error(
      'Migraciones bloqueadas. Revisa las migraciones pendientes y ejecuta con MIGRATE_CONFIRM=YES.',
    );
  }
}
