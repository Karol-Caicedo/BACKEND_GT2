import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

const JWT_SECRET = 'x'.repeat(32);

function buildStrategy(user: Record<string, unknown> | null) {
  const users = { findById: jest.fn().mockResolvedValue(user) };
  const config = new ConfigService({ JWT_SECRET });
  const strategy = new JwtStrategy(config, users as never);
  return { strategy, users };
}

type StrategyHarness = {
  authenticate(req: { headers: { authorization: string } }): void;
  success(user: unknown, info?: unknown): void;
  fail(info?: unknown): void;
  error(err: Error): void;
};

function autenticar(strategy: JwtStrategy, token: string): Promise<{ outcome: string; detail?: unknown }> {
  const harness = strategy as unknown as StrategyHarness;
  return new Promise((resolve) => {
    harness.success = (user) => resolve({ outcome: 'success', detail: user });
    harness.fail = (detail) => resolve({ outcome: 'fail', detail });
    harness.error = (detail) => resolve({ outcome: 'error', detail });
    harness.authenticate({ headers: { authorization: `Bearer ${token}` } });
  });
}

describe('JwtStrategy', () => {
  test('rechaza un token emitido antes de un cambio de contraseña', async () => {
    const { strategy } = buildStrategy({
      id: 'u-1',
      correo: 'est@unipacifico.edu.co',
      rol: 'ESTUDIANTE',
      semestre: 4,
      nombre: 'Est',
      tokenVersion: 2,
    });

    await expect(strategy.validate({ sub: 'u-1', tokenVersion: 1 })).resolves.toBeNull();
  });

  test('acepta el token con la versión vigente', async () => {
    const { strategy } = buildStrategy({
      id: 'u-1',
      correo: 'est@unipacifico.edu.co',
      rol: 'ESTUDIANTE',
      semestre: 4,
      nombre: 'Est',
      tokenVersion: 2,
    });

    await expect(strategy.validate({ sub: 'u-1', tokenVersion: 2 })).resolves.toMatchObject({ id: 'u-1' });
  });

  test('acepta tokens antiguos solo si el usuario sigue en versión 0', async () => {
    const { strategy } = buildStrategy({
      id: 'u-1',
      correo: 'est@unipacifico.edu.co',
      rol: 'ESTUDIANTE',
      semestre: 4,
      nombre: 'Est',
      tokenVersion: 0,
    });

    await expect(strategy.validate({ sub: 'u-1' })).resolves.toMatchObject({ id: 'u-1' });
  });

  test.each([
    ['firmado con secreto incorrecto', new JwtService({ secret: 'otro-secreto' }).sign({ sub: 'u-1' })],
    ['expirado', new JwtService({ secret: JWT_SECRET }).sign({ sub: 'u-1' }, { expiresIn: -1 })],
    ['firmado con algoritmo no permitido', new JwtService({ secret: JWT_SECRET }).sign({ sub: 'u-1' }, { algorithm: 'HS384' })],
  ])('rechaza JWT %s', async (_caso, token) => {
    const user = {
      id: 'u-1',
      correo: 'est@unipacifico.edu.co',
      rol: 'ESTUDIANTE',
      semestre: 4,
      nombre: 'Est',
      tokenVersion: 0,
    };
    const { strategy } = buildStrategy(user);

    await expect(autenticar(strategy, token)).resolves.toMatchObject({ outcome: 'fail' });
  });
});
