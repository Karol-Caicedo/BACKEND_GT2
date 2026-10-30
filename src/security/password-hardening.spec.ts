import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../modules/auth/auth.service';
import { mockRepository, mockUsersService } from '../test/test-utils';

function buildService(env: Record<string, string> = {}) {
  const users = mockUsersService();
  const jwt = new JwtService({ secret: 'test-secret' });
  const config = new ConfigService({
    ALLOWED_EMAIL_DOMAIN: '@unipacifico.edu.co',
    AUTH_SSO_ENABLED: 'false',
    PASSWORD_REHASH_ON_LOGIN: 'false',
    ...env,
  });
  const resets = mockRepository();
  const resend = { enviarRecuperacion: jest.fn().mockResolvedValue({ simulado: true }) };
  const svc = new AuthService(users as never, jwt, config, resets as never, mockRepository() as never, resend as never);
  return { svc, users };
}

const usuario = () => ({
  id: 'u-1',
  correo: 'est@unipacifico.edu.co',
  nombre: 'Est Uno',
  passwordHash: bcrypt.hashSync('Clave1234', 4),
  proveedorAuth: 'local',
  proveedorId: null,
  semestre: 4,
  rol: 'ESTUDIANTE',
  tokenVersion: 0,
  aceptoDatosAt: new Date(),
});

describe('C-01 endurecimiento de contraseñas', () => {
  test('register almacena Argon2id y nunca texto plano', async () => {
    const { svc, users } = buildService();
    users.findByCorreo.mockResolvedValue(null);

    await svc.register({
      correo: 'nuevo@unipacifico.edu.co',
      nombre: 'Nuevo',
      password: 'Clave1234',
      semestre: 2,
      aceptoDatos: true,
    });

    const creado = users.create.mock.calls[0][0] as Record<string, unknown>;
    expect(creado.passwordHash).toEqual(expect.stringMatching(/^\$argon2id\$/));
    expect(creado.passwordHash).not.toBe('Clave1234');
    expect(await argon2.verify(String(creado.passwordHash), 'Clave1234')).toBe(true);
    expect(creado).not.toHaveProperty('passwordPlano');
  });

  test('login con hash bcrypt legado lo rehashea a Argon2id cuando se habilita', async () => {
    const { svc, users } = buildService({ PASSWORD_REHASH_ON_LOGIN: 'true' });
    const user = usuario();
    users.findByCorreo.mockResolvedValue(user);

    await svc.login(user.correo, 'Clave1234');

    expect(user.passwordHash).toEqual(expect.stringMatching(/^\$argon2id\$/));
    expect(await argon2.verify(user.passwordHash, 'Clave1234')).toBe(true);
    expect(users.save).toHaveBeenCalledWith(user);
  });

  test('por defecto no rehashea hashes bcrypt sin aprobación', async () => {
    const { svc, users } = buildService();
    const user = usuario();
    users.findByCorreo.mockResolvedValue(user);

    await svc.login(user.correo, 'Clave1234');

    expect(user.passwordHash).toEqual(expect.stringMatching(/^\$2[aby]\$/));
    expect(users.save).not.toHaveBeenCalled();
  });

  test('login rechaza una clave incorrecta sin rehashear', async () => {
    const { svc, users } = buildService({ PASSWORD_REHASH_ON_LOGIN: 'true' });
    const user = usuario();
    users.findByCorreo.mockResolvedValue(user);

    await expect(svc.login(user.correo, 'OtraClave99')).rejects.toThrow(/Credenciales inválidas/);
    expect(user.passwordHash).toEqual(expect.stringMatching(/^\$2[aby]\$/));
    expect(users.save).not.toHaveBeenCalled();
  });
});
