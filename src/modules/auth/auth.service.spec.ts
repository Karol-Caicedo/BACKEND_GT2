import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { mockUsersService, mockRepository } from '../../test/test-utils';

function mockResend() {
  return { enviarRecuperacion: jest.fn().mockResolvedValue({ simulado: true }) };
}

const DOMINIO = '@unipacifico.edu.co';

function buildService(env: Record<string, string> = {}) {
  const users = mockUsersService();
  const jwt = new JwtService({ secret: 'test-secret' });
  const config = new ConfigService({
    ALLOWED_EMAIL_DOMAIN: DOMINIO,
    AUTH_SSO_ENABLED: 'false',
    ...env,
  });
  const resets = mockRepository();
  const ssoCodes = mockRepository();
  const resend = mockResend();
  const svc = new AuthService(users as never, jwt, config, resets as never, ssoCodes as never, resend as never);
  return { svc, users, jwt, resets, ssoCodes, resend };
}

function updateBuilder(resultado: { affected: number; raw?: unknown[] }) {
  const builder = {
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(resultado),
  };
  return builder;
}

const baseUser = {
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
};

describe('AuthService', () => {
  test('elimina periódicamente los códigos SSO vencidos y sus datos asociados', async () => {
    const { svc, ssoCodes } = buildService();
    await svc.limpiarCodigosSsoVencidos();
    expect(ssoCodes.delete).toHaveBeenCalledWith({
      expiraAt: expect.objectContaining({ _type: 'lessThanOrEqual' }),
    });
  });

  describe('ssoEnabled', () => {
    test.each([
      ['true', true],
      ['TRUE', true],
      [' True ', true],
      ['false', false],
      ['', false],
    ])('AUTH_SSO_ENABLED=%j → %s', (valor, esperado) => {
      const { svc } = buildService({ AUTH_SSO_ENABLED: valor });
      expect(svc.ssoEnabled()).toBe(esperado);
    });

    test('sin variable → deshabilitado', () => {
      const users = mockUsersService();
      const svc = new AuthService(users as never, new JwtService({ secret: 'x' }), new ConfigService({}), mockRepository() as never, mockRepository() as never, mockResend() as never);
      expect(svc.ssoEnabled()).toBe(false);
    });
  });

  describe('register', () => {
    test('rechaza correo de otro dominio', async () => {
      const { svc } = buildService();
      await expect(
        svc.register({ correo: 'yo@gmail.com', nombre: 'X', password: 'Clave1234', semestre: 2, aceptoDatos: true }),
      ).rejects.toThrow(BadRequestException);
    });

    test('rechaza correo duplicado', async () => {
      const { svc, users } = buildService();
      users.findByCorreo.mockResolvedValue(baseUser);
      await expect(
        svc.register({ correo: baseUser.correo, nombre: 'X', password: 'Clave1234', semestre: 2, aceptoDatos: true }),
      ).rejects.toThrow(/ya está registrado/);
      expect(users.create).not.toHaveBeenCalled();
    });

    test('crea ESTUDIANTE con hash, rol y fecha de consentimiento; devuelve solo el token', async () => {
      const { svc, users, jwt } = buildService();
      users.findByCorreo.mockResolvedValue(null);
      const r = await svc.register({
        correo: 'NUEVO@unipacifico.edu.co',
        nombre: 'Nuevo',
        password: 'Clave1234',
        semestre: 3,
        aceptoDatos: true,
      });
      expect(users.create).toHaveBeenCalledTimes(1);
      const creado = users.create.mock.calls[0][0] as Record<string, any>;
      expect(creado.correo).toBe('nuevo@unipacifico.edu.co');
      expect(creado.rol).toBe('ESTUDIANTE');
      expect(creado.proveedorAuth).toBe('local');
      expect(creado.aceptoDatosAt).toBeInstanceOf(Date);
      expect(creado.passwordHash).not.toBe('Clave1234');
      expect(await argon2.verify(creado.passwordHash, 'Clave1234')).toBe(true);
      expect(creado).not.toHaveProperty('passwordPlano');
      expect(r.access_token).toBeTruthy();
      expect(r).toEqual({ access_token: expect.any(String) });
      const payload = jwt.verify(r.access_token) as Record<string, unknown>;
      expect(payload).toMatchObject({ sub: 'uuid-user', tokenVersion: 0 });
      expect(payload).not.toHaveProperty('correo');
      expect(payload).not.toHaveProperty('rol');
      expect(payload).not.toHaveProperty('semestre');
    });

    test('acepta mayúsculas en el dominio institucional', async () => {
      const { svc, users } = buildService();
      users.findByCorreo.mockResolvedValue(null);
      await svc.register({ correo: 'yo@unipacifico.edu.co', nombre: 'X', password: 'Clave1234', semestre: 1, aceptoDatos: true });
      expect(users.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    test('credenciales válidas devuelven JWT mínimo sin duplicar el perfil', async () => {
      const { svc, users, jwt } = buildService();
      users.findByCorreo.mockResolvedValue(baseUser);
      const r = await svc.login(baseUser.correo, 'Clave1234');
      const payload = jwt.verify(r.access_token) as Record<string, unknown>;
      expect(payload).toMatchObject({ sub: 'u-1', tokenVersion: 0 });
      expect(payload).not.toHaveProperty('correo');
      expect(payload).not.toHaveProperty('nombre');
      expect(payload).not.toHaveProperty('rol');
      expect(payload).not.toHaveProperty('semestre');
      expect(payload).not.toHaveProperty('numeroIdentificacion');
      expect(payload).not.toHaveProperty('proveedorId');
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('passwordHash');
      expect(r).toEqual({ access_token: expect.any(String) });
    });

    test.each([
      ['usuario inexistente', null, 'Clave1234'],
      ['clave errada', { ...baseUser }, 'OtraClave99'],
      ['usuario SSO sin password', { ...baseUser, passwordHash: null }, 'Clave1234'],
    ])('rechaza %s con 401', async (_c, user, pass) => {
      const { svc } = buildService();
      svc['users'].findByCorreo = jest.fn().mockResolvedValue(user);
      await expect(svc.login('x@unipacifico.edu.co', pass)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('me / actualizarMiSemestre', () => {
    test('me nunca expone passwordHash', async () => {
      const { svc, users } = buildService();
      users.findById.mockResolvedValue(baseUser);
      const me = await svc.me('u-1');
      expect(me).not.toHaveProperty('passwordHash');
      expect(me).not.toHaveProperty('tokenVersion');
      expect(me).not.toHaveProperty('proveedorId');
      expect(me).not.toHaveProperty('proveedorAuth');
      expect(me).toEqual({
        id: baseUser.id,
        correo: baseUser.correo,
        nombre: baseUser.nombre,
        semestre: baseUser.semestre,
        rol: baseUser.rol,
      });
    });

    test('me con id desconocido → 401', async () => {
      const { svc, users } = buildService();
      users.findById.mockResolvedValue(null);
      await expect(svc.me('nope')).rejects.toThrow(UnauthorizedException);
    });

    test.each([0, 10, -1, 99])('semestre %i inválido → 400', async (s) => {
      const { svc } = buildService();
      await expect(svc.actualizarMiSemestre('u-1', s)).rejects.toThrow(/Semestre inválido/);
    });

    test('actualiza y persiste el semestre', async () => {
      const { svc, users } = buildService();
      const u = { ...baseUser };
      users.findById.mockResolvedValue(u);
      const me = await svc.actualizarMiSemestre('u-1', 7);
      expect(u.semestre).toBe(7);
      expect(users.save).toHaveBeenCalledWith(u);
      expect(me).toHaveProperty('semestre', 7);
    });
  });

  describe('loginSso', () => {
    const perfil = { correo: 'sso@unipacifico.edu.co', nombre: 'SSO User', proveedorId: 'g-1' };

    test('sin correo del proveedor → 400', async () => {
      const { svc } = buildService();
      await expect(svc.loginSso({ correo: '', nombre: 'X', proveedorId: 'g-9' }, 'google')).rejects.toThrow(BadRequestException);
    });

    test('dominio externo → 400', async () => {
      const { svc } = buildService();
      await expect(svc.loginSso({ ...perfil, correo: 'x@gmail.com' }, 'google')).rejects.toThrow(BadRequestException);
    });

    test('usuario nuevo → código temporal opaco (no crea usuario ni expone su perfil)', async () => {
      const { svc, users, ssoCodes } = buildService();
      users.findByCorreo.mockResolvedValue(null);
      const r = await svc.loginSso(perfil, 'google');
      expect(r.necesitaCompletar).toBe(true);
      expect(users.create).not.toHaveBeenCalled();
      expect(r).toEqual({ necesitaCompletar: true, temp: expect.any(String) });
      expect((r as { temp: string }).temp).not.toContain('.');
      expect(ssoCodes.save).toHaveBeenCalledWith(expect.objectContaining({
        datos: { tipo: 'registro_pendiente', ...perfil, proveedor: 'google' },
      }));
    });

    test('usuario existente sin proveedor → lo vincula y firma JWT', async () => {
      const { svc, users } = buildService();
      const u = { ...baseUser, correo: perfil.correo, proveedorId: null };
      users.findByCorreo.mockResolvedValue(u);
      const r = await svc.loginSso(perfil, 'microsoft');
      expect(r.necesitaCompletar).toBe(false);
      expect(u.proveedorId).toBe('g-1');
      expect(u.proveedorAuth).toBe('microsoft');
      expect(users.save).toHaveBeenCalledWith(u);
      expect((r as { access_token: string }).access_token).toBeTruthy();
    });

    test('usuario ya vinculado → no re-guarda', async () => {
      const { svc, users } = buildService();
      users.findByCorreo.mockResolvedValue({ ...baseUser, proveedorId: 'g-1', proveedorAuth: 'google' });
      await svc.loginSso(perfil, 'google');
      expect(users.save).not.toHaveBeenCalled();
    });
  });

  describe('completarSso', () => {
    const datos = {
      tipo: 'registro_pendiente',
      correo: 'nuevo@unipacifico.edu.co',
      nombre: 'Nuevo',
      proveedorId: 'g-2',
      proveedor: 'google',
    };

    test('token desconocido o ya usado → 400', async () => {
      const { svc, ssoCodes } = buildService();
      ssoCodes.createQueryBuilder.mockReturnValue(updateBuilder({ affected: 0, raw: [] }));
      await expect(svc.completarSso('no-es-un-jwt', { semestre: 2, aceptoDatos: true })).rejects.toThrow(/inválido o vencido/);
    });

    test('token opaco válido crea usuario sin password y con consentimiento', async () => {
      const { svc, users, ssoCodes } = buildService();
      users.findByCorreo.mockResolvedValue(null);
      const builder = updateBuilder({ affected: 1, raw: [{ datos }] });
      ssoCodes.createQueryBuilder.mockReturnValue(builder);
      const temp = 'opaque-pending-token';
      const r = await svc.completarSso(temp, { semestre: 5, aceptoDatos: true });
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.from).toHaveBeenCalled();
      const creado = users.create.mock.calls[0][0] as Record<string, any>;
      expect(creado).toMatchObject({
        correo: datos.correo,
        passwordHash: null,
        proveedorAuth: datos.proveedor,
        proveedorId: datos.proveedorId,
        semestre: 5,
        rol: 'ESTUDIANTE',
      });
      expect(creado.aceptoDatosAt).toBeInstanceOf(Date);
      expect(r.access_token).toBeTruthy();
      expect(builder.where.mock.calls[0][0]).toContain('"expira_at" > now()');
      expect(builder.where.mock.calls[0][0]).toContain('"datos"->>\'tipo\'');
    });

    test('si el correo se registró entretanto → 400', async () => {
      const { svc, users, ssoCodes } = buildService();
      users.findByCorreo.mockResolvedValue(baseUser);
      ssoCodes.createQueryBuilder.mockReturnValue(updateBuilder({ affected: 1, raw: [{ datos }] }));
      const temp = 'opaque-pending-token';
      await expect(svc.completarSso(temp, { semestre: 5, aceptoDatos: true })).rejects.toThrow(/ya está registrado/);
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('SSO exchange', () => {
    const perfil = { correo: 'nuevo@unipacifico.edu.co', nombre: 'Nuevo', proveedorId: 'g-2' };

    test('usuario existente intercambia código por sesión sin duplicar el perfil', async () => {
      const { svc, users, ssoCodes } = buildService();
      const user = { ...baseUser, correo: perfil.correo, proveedorId: perfil.proveedorId, proveedorAuth: 'google' };
      users.findByCorreo.mockResolvedValue(user);
      users.findById.mockResolvedValue(user);
      const codigo = await svc.crearCodigoSso(perfil, 'google');
      expect(ssoCodes.save).toHaveBeenCalledWith(expect.objectContaining({
        usuarioId: user.id,
        datos: null,
      }));
      ssoCodes.createQueryBuilder.mockReturnValue(updateBuilder({
        affected: 1,
        raw: [{ usuario_id: user.id, datos: null }],
      }));

      const resultado = await svc.intercambiarCodigoSso(codigo);
      expect(resultado).toEqual({ access_token: expect.any(String), necesitaCompletar: false });
      expect(ssoCodes.createQueryBuilder().delete).toHaveBeenCalled();
    });

    test('usuario nuevo recibe código opaco y el alta consume una sola vez los datos guardados', async () => {
      const { svc, users, ssoCodes } = buildService();
      users.findByCorreo.mockResolvedValue(null);
      const codigo = await svc.crearCodigoSso(perfil, 'google');
      ssoCodes.createQueryBuilder.mockReturnValue(updateBuilder({
        affected: 1,
        raw: [{ usuario_id: null, datos: { tipo: 'intercambio', ...perfil, proveedor: 'google' } }],
      }));

      const intercambio = await svc.intercambiarCodigoSso(codigo);
      expect(intercambio).toEqual({ necesitaCompletar: true, temp: expect.any(String) });
      const temp = (intercambio as { temp: string }).temp;
      expect(temp).not.toContain('.');
      expect(JSON.stringify(intercambio)).not.toContain(perfil.correo);

      ssoCodes.createQueryBuilder.mockReturnValue(updateBuilder({
        affected: 1,
        raw: [{ datos: { tipo: 'registro_pendiente', ...perfil, proveedor: 'google' } }],
      }));
      const sesion = await svc.completarSso(temp, { semestre: 4, aceptoDatos: true });
      expect(sesion).toEqual({ access_token: expect.any(String) });
      expect(users.create).toHaveBeenCalledWith(expect.objectContaining({
        correo: perfil.correo,
        proveedorAuth: 'google',
        proveedorId: perfil.proveedorId,
        semestre: 4,
      }));

      ssoCodes.createQueryBuilder.mockReturnValue(updateBuilder({ affected: 0, raw: [] }));
      await expect(svc.completarSso(temp, { semestre: 4, aceptoDatos: true })).rejects.toThrow(/inválido o vencido/);
    });
  });
});

describe('AuthService recuperación de contraseña', () => {
  const MENSAJE = 'Si el correo está registrado, recibirás un correo con instrucciones para restablecer tu contraseña.';

  test('correo inexistente responde genérico sin crear token ni enviar correo', async () => {
    const { svc, users, resets, resend } = buildService();
    users.findByCorreo.mockResolvedValue(null);
    await expect(svc.solicitarRecuperacion('nadie@unipacifico.edu.co')).resolves.toEqual({ mensaje: MENSAJE });
    expect(resets.save).not.toHaveBeenCalled();
    expect(resend.enviarRecuperacion).not.toHaveBeenCalled();
  });

  test('usuario existente invalida tokens previos, guarda hash y envía correo', async () => {
    const { svc, users, resets, resend } = buildService();
    users.findByCorreo.mockResolvedValue(baseUser);
    await expect(svc.solicitarRecuperacion('EST@unipacifico.edu.co')).resolves.toEqual({ mensaje: MENSAJE });
    expect(resets.update).toHaveBeenCalledWith(
      { usuarioId: 'u-1', usadoAt: null },
      expect.objectContaining({ usadoAt: expect.any(Date) }),
    );
    const creado = resets.create.mock.calls[0][0] as Record<string, any>;
    expect(creado.usuarioId).toBe('u-1');
    expect(creado.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(creado.usadoAt).toBeNull();
    expect(creado.expiraAt.getTime()).toBeGreaterThan(Date.now());
    expect(resend.enviarRecuperacion).toHaveBeenCalledTimes(1);
    const [para, nombre, codigo, url] = resend.enviarRecuperacion.mock.calls[0];
    expect(para).toBe(baseUser.correo);
    expect(nombre).toBe(baseUser.nombre);
    expect(codigo).toEqual(expect.any(String));
    expect(url).toContain('/auth/restablecer');
    expect(url).not.toContain('token');
  });

  test('restablecer con token válido fija la clave y marca uso único', async () => {
    const { svc, users, resets } = buildService();
    const user = { ...baseUser, passwordHash: 'viejo' };
    const registro = { id: 'r-1', usuarioId: 'u-1', usadoAt: null, expiraAt: new Date(Date.now() + 60000) };
    resets.findOne.mockResolvedValue(registro);
    users.findById.mockResolvedValue(user);
    await expect(svc.restablecerClave('tokencualquiera1234567890', 'NuevaClave1')).resolves.toHaveProperty('mensaje');
    expect(user.passwordHash).not.toBe('viejo');
    expect(await argon2.verify(user.passwordHash, 'NuevaClave1')).toBe(true);
    expect(user.tokenVersion).toBe(1);
    expect(user).not.toHaveProperty('passwordPlano');
    expect(users.save).toHaveBeenCalledWith(user);
    expect(resets.update).toHaveBeenCalledWith(
      { id: 'r-1', usadoAt: expect.anything(), expiraAt: expect.anything() },
      expect.objectContaining({ usadoAt: expect.any(Date) }),
    );
    expect(resets.save).not.toHaveBeenCalled();
  });

  test('si otro proceso ya consumió el token, no cambia la clave', async () => {
    const { svc, users, resets } = buildService();
    const user = { ...baseUser, passwordHash: 'viejo' };
    resets.findOne.mockResolvedValue({ id: 'r-1', usuarioId: 'u-1', usadoAt: null, expiraAt: new Date(Date.now() + 60000) });
    users.findById.mockResolvedValue(user);
    resets.update.mockResolvedValueOnce({ affected: 0 });
    await expect(svc.restablecerClave('tokencualquiera1234567890', 'NuevaClave1')).rejects.toThrow(/inválido o ya venció/);
    expect(user.passwordHash).toBe('viejo');
    expect(users.save).not.toHaveBeenCalled();
  });

  test.each([
    ['token desconocido', null, 'NuevaClave12'],
    ['token ya usado', { usuarioId: 'u-1', usadoAt: new Date(), expiraAt: new Date(Date.now() + 60000) }, 'NuevaClave12'],
    ['token vencido', { usuarioId: 'u-1', usadoAt: null, expiraAt: new Date(Date.now() - 1000) }, 'NuevaClave12'],
  ])('rechaza %s', async (_c, registro, pass) => {
    const { svc, resets } = buildService();
    resets.findOne.mockResolvedValue(registro);
    await expect(svc.restablecerClave('tokencualquiera1234567890', pass as string)).rejects.toThrow(/inválido o ya venció/);
  });

  test('rechaza clave corta sin tocar la BD', async () => {
    const { svc, users } = buildService();
    await expect(svc.restablecerClave('tokencualquiera1234567890', 'corta')).rejects.toThrow(/8 caracteres/);
    expect(users.findById).not.toHaveBeenCalled();
  });
});

describe('AuthService recuperación ante fallo de envío', () => {
  test('si Resend falla, igual responde genérico (no filtra cuentas) y guarda el token', async () => {
    const { svc, users, resets, resend } = buildService();
    users.findByCorreo.mockResolvedValue({
      id: 'u-1', correo: 'est@universidad.edu.co', nombre: 'Est Uno',
    });
    resend.enviarRecuperacion.mockRejectedValue(new Error('No se pudo enviar (Resend 403)'));
    const loggerError = jest.spyOn(require('@nestjs/common').Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(svc.solicitarRecuperacion('est@universidad.edu.co')).resolves.toEqual({
      mensaje: 'Si el correo está registrado, recibirás un correo con instrucciones para restablecer tu contraseña.',
    });
    expect(resets.save).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalled();
    const log = JSON.stringify(loggerError.mock.calls);
    expect(log).not.toContain('est@universidad.edu.co');
    expect(log).not.toContain('token=');
    loggerError.mockRestore();
  });
});
