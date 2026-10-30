import { readFileSync } from 'fs';
import { join } from 'path';
import { debeCrearEstudianteDemo, esProduccion, validarClaveProduccion } from './seed-policy';

describe('C-03 política de seed en producción', () => {
  test.each([
    [['node', 'seed.js'], 'production', true],
    [['node', 'seed.js', '--prod'], 'development', true],
    [['node', 'seed.js'], 'development', false],
  ])('detecta producción con argv %j y NODE_ENV %s', (argv, nodeEnv, esperado) => {
    expect(esProduccion(argv, nodeEnv)).toBe(esperado);
  });

  test.each([undefined, '', 'corta', 'Admin123*', 'Estudiante123*', 'C0{ABX3Yk4qxs'])(
    'rechaza la clave de administrador %p en producción',
    (clave) => {
      expect(() => validarClaveProduccion('ADMIN_PASSWORD', clave)).toThrow(/ADMIN_PASSWORD/);
    },
  );

  test('acepta una clave de producción no demo de 8+ caracteres', () => {
    expect(validarClaveProduccion('ADMIN_PASSWORD', 'ClaveUnica2026!')).toBe('ClaveUnica2026!');
  });

  test('el estudiante demo queda omitido en producción salvo habilitación explícita', () => {
    expect(debeCrearEstudianteDemo(true, undefined)).toBe(false);
    expect(debeCrearEstudianteDemo(true, 'false')).toBe(false);
    expect(debeCrearEstudianteDemo(true, 'true')).toBe(true);
    expect(debeCrearEstudianteDemo(false, 'false')).toBe(true);
  });

  test('Railway no ejecuta el seed automáticamente en cada despliegue', () => {
    const railway = JSON.parse(readFileSync(join(__dirname, '..', '..', 'railway.json'), 'utf8'));
    expect(railway.deploy.startCommand).not.toMatch(/seed/);
    expect(railway.deploy.startCommand).toContain('start:prod');
  });
});
