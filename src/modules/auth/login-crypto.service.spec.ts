import { generateKeyPairSync } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';
import { LoginCryptoService } from './login-crypto.service';
import { cifrarLogin, LoginEnvelope } from '../../../../frontend/src/app/core/login-crypto';

function crearCryptoService() {
  const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
  const privateKey = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const execute = jest.fn().mockResolvedValue({ affected: 1 });
  const builder = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute,
  };
  const challenges = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => row),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => builder),
  };
  const config = new ConfigService({
    LOGIN_CRYPTO_ACTIVE_KEY_ID: 'rsa-test',
    LOGIN_CRYPTO_KEYS_JSON: JSON.stringify({ 'rsa-test': privateKey }),
  });
  const service = new LoginCryptoService(config, challenges as never);
  service.onModuleInit();
  return { service, challenges, execute };
}

describe('LoginCryptoService', () => {
  test('el frontend envía solo el sobre cifrado y el backend recupera las credenciales', async () => {
    const { service, challenges } = crearCryptoService();
    const params = await service.crearParametros();
    const credentials = { correo: 'persona@unipacifico.edu.co', password: 'Clave-de-prueba-984' };
    const envelope = await cifrarLogin(credentials, params);

    expect(JSON.stringify(envelope)).not.toContain(credentials.correo);
    expect(JSON.stringify(envelope)).not.toContain(credentials.password);
    expect(Object.keys(envelope).sort()).toEqual(['challenge', 'ciphertext', 'iv', 'keyId', 'version', 'wrappedKey']);
    await expect(service.descifrar(envelope)).resolves.toEqual(credentials);
    expect(challenges.createQueryBuilder).toHaveBeenCalled();
  });

  test('consume el desafío de forma de un solo uso y rechaza la repetición', async () => {
    const { service, execute } = crearCryptoService();
    const params = await service.crearParametros();
    const envelope = await cifrarLogin({ correo: 'persona@unipacifico.edu.co', password: 'Clave-de-prueba-984' }, params);

    await expect(service.descifrar(envelope)).resolves.toMatchObject({ correo: 'persona@unipacifico.edu.co' });
    execute.mockResolvedValueOnce({ affected: 0 });
    await expect(service.descifrar(envelope)).rejects.toThrow('Sobre de inicio de sesión inválido o vencido');
  });

  test('reporta servicio no disponible cuando la tabla de desafíos no existe', async () => {
    const { service, challenges } = crearCryptoService();
    challenges.save.mockRejectedValueOnce(new QueryFailedError('INSERT INTO', [], { code: '42P01' } as never));

    await expect(service.crearParametros()).rejects.toThrow('El inicio de sesión seguro no está disponible');
  });

  test('rechaza el login con un servicio no disponible si la tabla está ausente', async () => {
    const { service, challenges } = crearCryptoService();
    const params = await service.crearParametros();
    const envelope = await cifrarLogin({ correo: 'persona@unipacifico.edu.co', password: 'Clave-de-prueba-984' }, params);
    challenges.createQueryBuilder.mockImplementationOnce(() => {
      throw new QueryFailedError('DELETE FROM', [], { code: '42P01' } as never);
    });

    await expect(service.descifrar(envelope)).rejects.toThrow('El inicio de sesión seguro no está disponible');
  });

  test.each([
    ['cifrado manipulado', (envelope: LoginEnvelope) => ({ ...envelope, ciphertext: `${envelope.ciphertext}A` })],
    ['clave desconocida', (envelope: LoginEnvelope) => ({ ...envelope, keyId: 'unknown' })],
    ['sobre incompleto', (envelope: LoginEnvelope) => ({ version: envelope.version })],
  ])('rechaza %s sin revelar detalles criptográficos', async (_label, mutate) => {
    const { service } = crearCryptoService();
    const params = await service.crearParametros();
    const original = await cifrarLogin({ correo: 'persona@unipacifico.edu.co', password: 'Clave-de-prueba-984' }, params);
    await expect(service.descifrar(mutate(original) as never)).rejects.toThrow(
      'Sobre de inicio de sesión inválido o vencido',
    );
  });

  test('rechaza desafíos vencidos sin intentar descifrar', async () => {
    const { service, execute } = crearCryptoService();
    const params = await service.crearParametros();
    const envelope = await cifrarLogin({ correo: 'persona@unipacifico.edu.co', password: 'Clave-de-prueba-984' }, params);
    execute.mockResolvedValueOnce({ affected: 0 });

    await expect(service.descifrar(envelope)).rejects.toThrow('Sobre de inicio de sesión inválido o vencido');
  });
});
