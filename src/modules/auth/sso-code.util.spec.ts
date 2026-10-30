import { hashSsoCode, leerCookie, opcionesCookieSso } from './sso-code.util';

describe('H-01 utilidades del código SSO', () => {
  test('el hash es determinista y nunca devuelve el código original', () => {
    const codigo = 'codigo-secreto';
    expect(hashSsoCode(codigo)).toBe(hashSsoCode(codigo));
    expect(hashSsoCode(codigo)).toHaveLength(64);
    expect(hashSsoCode(codigo)).not.toBe(codigo);
  });

  test('la cookie es HttpOnly, SameSite Lax, de 60s y Secure en producción', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(opcionesCookieSso()).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAge: 60000,
        path: '/api/auth/sso',
      });
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  test('lee la cookie entre otras y decodifica el valor', () => {
    expect(leerCookie({ headers: { cookie: 'a=1; sigice_sso_code=c%C3%B3digo; b=2' } }, 'sigice_sso_code')).toBe('código');
    expect(leerCookie({ headers: {} }, 'sigice_sso_code')).toBeNull();
  });
});
