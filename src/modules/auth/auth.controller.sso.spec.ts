import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';

function respuestaFalsa() {
  return {
    setHeader: jest.fn(),
    redirect: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

describe('respuestas de autenticación y SSO', () => {
  const auth = {
    login: jest.fn(),
    loginSso: jest.fn(),
    crearCodigoSso: jest.fn(),
    intercambiarCodigoSso: jest.fn(),
  };
  const loginCrypto = {
    crearParametros: jest.fn(),
    descifrar: jest.fn(),
  };
  const config = new ConfigService({ FRONTEND_URL: 'https://app.example', AUTH_SSO_ENABLED: 'true' });
  const controller = new AuthController(auth as never, config, loginCrypto as never);

  beforeEach(() => {
    jest.clearAllMocks();
    auth.login.mockResolvedValue({ access_token: 'jwt-de-prueba' });
    auth.crearCodigoSso.mockResolvedValue('codigo-de-un-solo-uso');
  });

  test('el login conserva el contrato Bearer sin incluir campos internos de usuario', async () => {
    const sobre = {
      version: 1,
      keyId: 'rsa-test',
      challenge: 'A'.repeat(43),
      wrappedKey: 'ciphertext',
      iv: 'A'.repeat(16),
      ciphertext: 'encrypted',
    };
    loginCrypto.descifrar.mockResolvedValue({ correo: 'a@unipacifico.edu.co', password: 'clave-de-prueba' });
    const resultado = await controller.login(sobre);

    expect(resultado).toEqual({ access_token: 'jwt-de-prueba' });
    expect(loginCrypto.descifrar).toHaveBeenCalledWith(sobre);
    expect(auth.login).toHaveBeenCalledWith('a@unipacifico.edu.co', 'clave-de-prueba');
    expect(JSON.stringify(resultado)).not.toContain('passwordHash');
    expect(JSON.stringify(resultado)).not.toContain('tokenVersion');
    expect(JSON.stringify(resultado)).not.toContain('correo');
  });

  test('el callback redirige sin credenciales en la URL y entrega código en cookie HttpOnly', async () => {
    const res = respuestaFalsa();
    await controller.googleCb(
      { user: { correo: 'a@unipacifico.edu.co', nombre: 'A', proveedorId: 'g-1' } },
      res as never,
    );

    const destino = String(res.redirect.mock.calls[0][0]);
    expect(destino).toBe('https://app.example/auth/sso-callback');
    expect(destino).not.toContain('token');
    expect(destino).not.toContain('temp');
    expect(res.cookie).toHaveBeenCalledWith(
      'sigice_sso_code',
      'codigo-de-un-solo-uso',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/api/auth/sso', maxAge: 60000 }),
    );
    expect(auth.crearCodigoSso).toHaveBeenCalledWith(expect.objectContaining({ correo: 'a@unipacifico.edu.co' }), 'google');
  });

  test('el exchange exige la cookie del código', () => {
    expect(() => controller.exchange({ headers: {} }, respuestaFalsa() as never)).toThrow(/código/i);
  });

  test('el exchange consume el código y mantiene el token en el cuerpo para el cliente Bearer', () => {
    const res = respuestaFalsa();
    auth.intercambiarCodigoSso.mockReturnValue({
      access_token: 'jwt-de-prueba',
      necesitaCompletar: false,
    });
    const resultado = controller.exchange(
      { headers: { cookie: 'sigice_sso_code=codigo-de-un-solo-uso' } },
      res as never,
    );

    expect(auth.intercambiarCodigoSso).toHaveBeenCalledWith('codigo-de-un-solo-uso');
    expect(resultado).toEqual({ access_token: 'jwt-de-prueba', necesitaCompletar: false });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
