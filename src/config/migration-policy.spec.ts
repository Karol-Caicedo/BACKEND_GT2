import { ConfigService } from '@nestjs/config';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { confirmarMigracion, migracionesAutomaticasHabilitadas } from './migration-policy';

const BACKEND_SRC = join(__dirname, '..');
const MIGRACIONES = join(BACKEND_SRC, 'migrations');

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('C-04 política de migraciones', () => {
  test.each([
    [{ NODE_ENV: 'development' }, true],
    [{ NODE_ENV: 'test' }, true],
    [{ NODE_ENV: 'production' }, false],
    [{ NODE_ENV: 'production', DB_MIGRATIONS_RUN: 'true' }, false],
    [{ NODE_ENV: 'development', DB_MIGRATIONS_RUN: 'false' }, false],
  ])('migraciones automáticas con %j => %s', (env, esperado) => {
    expect(migracionesAutomaticasHabilitadas(new ConfigService(env))).toBe(esperado);
  });

  test('el runner protegido exige MIGRATE_CONFIRM=YES', () => {
    expect(() => confirmarMigracion(undefined)).toThrow(/MIGRATE_CONFIRM=YES/);
    expect(() => confirmarMigracion('yes')).not.toThrow();
    expect(() => confirmarMigracion('YES')).not.toThrow();
  });

  test('ninguna migración contiene TRUNCATE ni DELETE FROM', () => {
    const infractores = readdirSync(MIGRACIONES)
      .filter((nombre) => nombre.endsWith('.ts'))
      .filter((nombre) => /\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(sinComentarios(readFileSync(join(MIGRACIONES, nombre), 'utf8'))));

    expect(infractores).toEqual([]);
  });

  test('el arranque usa la política y el seed no ejecuta migraciones', () => {
    const appModule = readFileSync(join(BACKEND_SRC, 'app.module.ts'), 'utf8');
    const seed = readFileSync(join(BACKEND_SRC, 'seed.ts'), 'utf8');

    expect(appModule).toContain('migracionesAutomaticasHabilitadas(c)');
    expect(appModule).not.toMatch(/migrationsRun:\s*true/);
    expect(seed).not.toContain('runMigrations');
  });

  test('Railway ejecuta el runner protegido antes de iniciar la app', () => {
    const packageJson = JSON.parse(readFileSync(join(BACKEND_SRC, '..', 'package.json'), 'utf8'));
    const railway = JSON.parse(readFileSync(join(BACKEND_SRC, '..', '..', 'railway.json'), 'utf8'));
    expect(packageJson.scripts['migration:run:guarded']).toContain('migrate-guarded');
    expect(packageJson.scripts.start).not.toContain('migrate');
    expect(packageJson.scripts['start:prod']).toContain('NODE_ENV=production');
    expect(packageJson.scripts['start:prod']).not.toContain('migrate');
    expect(railway.deploy.startCommand).toBe(
      'MIGRATE_CONFIRM=YES npm run migrate:prod && npm --prefix backend run start:prod',
    );
  });
});
