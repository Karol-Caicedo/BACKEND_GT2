import { validarNombreTestDb } from './test-db';

describe('validarNombreTestDb', () => {
  test.each(['intereses_db_test', 'sigice_TEST', 'otra_base_test'])('acepta %s', (nombre) => {
    expect(() => validarNombreTestDb(nombre)).not.toThrow();
  });

  test.each(['intereses_db', 'postgres', 'produccion', 'test', 'intereses_test_prod'])('rechaza %s', (nombre) => {
    expect(() => validarNombreTestDb(nombre)).toThrow(/base de pruebas/);
  });
});
