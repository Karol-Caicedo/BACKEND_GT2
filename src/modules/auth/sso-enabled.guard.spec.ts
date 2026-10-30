import { NotFoundException } from '@nestjs/common';
import { SsoEnabledGuard } from './sso-enabled.guard';

describe('SsoEnabledGuard', () => {
  test('permite el flujo cuando el SSO está habilitado', () => {
    const guard = new SsoEnabledGuard({ ssoEnabled: () => true } as never);
    expect(guard.canActivate()).toBe(true);
  });

  test('oculta las rutas SSO cuando está deshabilitado', () => {
    const guard = new SsoEnabledGuard({ ssoEnabled: () => false } as never);
    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });
});
