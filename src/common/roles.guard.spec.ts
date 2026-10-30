import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function ctxWith(rolesMeta: string[] | undefined, user?: { rol: string }) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(rolesMeta) } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  const ctx = {
    getType: () => 'http',
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
  return guard.canActivate(ctx);
}

describe('RolesGuard', () => {
  test('sin metadato de roles → permite (ruta pública autenticada)', () => {
    expect(ctxWith(undefined, { rol: 'ESTUDIANTE' })).toBe(true);
    expect(ctxWith([], { rol: 'ESTUDIANTE' })).toBe(true);
  });

  test('rol requerido coincide → permite', () => {
    expect(ctxWith(['ADMIN'], { rol: 'ADMIN' })).toBe(true);
    expect(ctxWith(['ESTUDIANTE', 'ADMIN'], { rol: 'ESTUDIANTE' })).toBe(true);
  });

  test('rol distinto → deniega (el estudiante no entra al admin)', () => {
    expect(ctxWith(['ADMIN'], { rol: 'ESTUDIANTE' })).toBe(false);
  });

  test('sin usuario en el request → deniega', () => {
    expect(ctxWith(['ADMIN'], undefined)).toBe(false);
  });
});
