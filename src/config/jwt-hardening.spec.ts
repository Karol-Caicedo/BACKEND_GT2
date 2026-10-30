import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const BACKEND_SRC = join(__dirname, '..');

function archivosTs(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivosTs(ruta) : ruta.endsWith('.ts') ? [ruta] : [];
  });
}

function fuentes() {
  return archivosTs(BACKEND_SRC)
    .filter((ruta) => !ruta.endsWith('.spec.ts'))
    .map((ruta) => ({ ruta, contenido: readFileSync(ruta, 'utf8') }));
}

describe('C-02 configuración de JWT', () => {
  test('ningún módulo lee JWT_SECRET ni define secretos JWT por fuera de getJwtSecret', () => {
    const infractores = fuentes()
      .filter(({ ruta }) => !ruta.endsWith(join('config', 'jwt.config.ts')))
      .filter(({ contenido }) => /JWT_SECRET|dev-secret/.test(contenido))
      .map(({ ruta }) => relative(BACKEND_SRC, ruta));

    expect(infractores).toEqual([]);
  });

  test('los módulos que firman o verifican JWT usan getJwtSecret', () => {
    const consumidores = [
      join('modules', 'auth', 'auth.module.ts'),
      join('modules', 'auth', 'jwt.strategy.ts'),
      join('modules', 'auth', 'google.strategy.ts'),
      join('modules', 'auth', 'microsoft.strategy.ts'),
    ];

    for (const archivo of consumidores) {
      const contenido = readFileSync(join(BACKEND_SRC, archivo), 'utf8');
      expect(contenido).toContain('getJwtSecret');
    }
  });
});
