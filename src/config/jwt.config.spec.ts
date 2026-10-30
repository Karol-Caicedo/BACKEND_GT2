import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from './jwt.config';

describe('getJwtSecret', () => {
  test.each([
    ['sin valor', {}],
    ['valor corto', { JWT_SECRET: 'corto' }],
    ['fallback inseguro', { JWT_SECRET: 'dev-secret' }],
    ['valor de ejemplo', { JWT_SECRET: 'cambia-este-secreto-largo-y-aleatorio' }],
  ])('rechaza %s', (_caso, env) => {
    expect(() => getJwtSecret(new ConfigService(env))).toThrow(/JWT_SECRET/);
  });

  test('acepta un secreto de al menos 32 caracteres', () => {
    const secreto = 'x'.repeat(32);
    expect(getJwtSecret(new ConfigService({ JWT_SECRET: secreto }))).toBe(secreto);
  });
});
