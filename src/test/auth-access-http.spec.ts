import { INestApplication, Module, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessGuard } from '../common/access.guard';
import { AccessLogService } from '../common/access-log.service';
import { AccessPolicyService } from '../common/access-policy.service';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { AuthController } from '../modules/auth/auth.controller';
import { AuthService } from '../modules/auth/auth.service';
import { LoginCryptoService } from '../modules/auth/login-crypto.service';

const JWT_SECRET = 'test-secret-with-at-least-32-characters';

class TestJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_SECRET,
      algorithms: ['HS256'],
    });
  }

  validate(payload: { sub: string; rol?: string }) {
    return { id: payload.sub, rol: payload.rol };
  }
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ secret: JWT_SECRET, signOptions: { algorithm: 'HS256' } }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: ConfigService,
      useValue: new ConfigService({ ACCESS_POLICY_MODE: 'enforce' }),
    },
    AccessPolicyService,
    AccessLogService,
    TestJwtStrategy,
    {
      provide: AuthService,
      useValue: {
        login: jest.fn().mockResolvedValue({ access_token: 'issued-token' }),
        me: jest.fn().mockImplementation(async (id: string) => ({ id })),
      },
    },
    {
      provide: LoginCryptoService,
      useValue: {
        crearParametros: jest.fn().mockResolvedValue({
          version: 1,
          keyId: 'test-key',
          publicKey: 'test-public-key',
          challenge: 'test-challenge',
          expiresIn: 120,
        }),
        descifrar: jest.fn().mockResolvedValue({
          correo: 'estudiante@example.edu',
          password: 'test-password',
        }),
      },
    },
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
class AuthAccessTestModule {}

describe('acceso HTTP del login y rutas autenticadas', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await NestFactory.create(AuthAccessTestModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function url(path: string): Promise<string> {
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    return `http://127.0.0.1:${port}${path}`;
  }

  test('obtener parámetros de login cifrado funciona sin JWT', async () => {
    const response = await fetch(await url('/api/auth/login-crypto'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      version: 1,
      keyId: 'test-key',
      expiresIn: 120,
    });
  });

  test('el endpoint de login cifrado acepta el sobre sin JWT previo', async () => {
    const response = await fetch(await url('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1 }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ access_token: 'issued-token' });
  });

  test('el login puede devolver 401 por credenciales sin requerir JWT previo', async () => {
    jest.spyOn(app.get(AuthService), 'login').mockRejectedValueOnce(
      new UnauthorizedException('Credenciales inválidas'),
    );

    const response = await fetch(await url('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1 }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ message: 'No autenticado' });
  });

  test('la ruta de perfil rechaza JWT ausente e inválido y acepta un JWT válido', async () => {
    const sinToken = await fetch(await url('/api/auth/me'));
    expect(sinToken.status).toBe(401);

    const tokenInvalido = await fetch(await url('/api/auth/me'), {
      headers: { Authorization: 'Bearer token-invalido' },
    });
    expect(tokenInvalido.status).toBe(401);

    const tokenValido = await jwt.signAsync({ sub: 'usuario-test', rol: 'ESTUDIANTE' });
    const autenticado = await fetch(await url('/api/auth/me'), {
      headers: { Authorization: `Bearer ${tokenValido}` },
    });
    expect(autenticado.status).toBe(200);
    await expect(autenticado.json()).resolves.toEqual({ id: 'usuario-test' });
  });
});
