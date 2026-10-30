import { CanActivate, Controller, ExecutionContext, Get, INestApplication, Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { AccessGuard } from '../common/access.guard';
import { AccessLogService } from '../common/access-log.service';
import { AccessPolicyService } from '../common/access-policy.service';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { Auth } from '../common/auth.decorator';
import { correlationIdMiddleware } from '../common/correlation-id.middleware';
import { corsOriginGuard } from '../common/cors-origin.middleware';
import { HealthController } from '../common/health.controller';
import { Public } from '../common/public.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UnknownRouteController } from '../common/unknown-route.controller';

@Injectable()
class TestUserGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; user?: { id: string; rol: string } }>();
    const rol = req.headers['x-test-rol'];
    if (rol) req.user = { id: 'usuario-test', rol };
    return true;
  }
}

@Controller('demo')
class DemoController {
  @Get('publico')
  @Public()
  publico() {
    return { ok: true };
  }

  @Get('sin-decorar')
  sinDecorar() {
    return { ok: true };
  }

  @Get('solo-admin')
  @Auth('ADMIN')
  soloAdmin() {
    return { ok: true };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
  controllers: [DemoController, HealthController, UnknownRouteController],
  providers: [
    AccessPolicyService,
    AccessLogService,
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_GUARD, useClass: TestUserGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
class AccesoTestModule {}

async function crearApp(mode: 'enforce' | 'audit'): Promise<INestApplication> {
  process.env.ACCESS_POLICY_MODE = mode;
  const app = await NestFactory.create(AccesoTestModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use(correlationIdMiddleware);
  app.useGlobalFilters(new AllExceptionsFilter());
  const accessLog = app.get(AccessLogService);
  app.use(corsOriginGuard(new Set(['http://localhost:4200']), accessLog));
  app.enableCors({ origin: ['http://localhost:4200'], credentials: true });
  await app.listen(0);
  return app;
}

async function url(app: INestApplication, ruta: string): Promise<string> {
  const direccion = app.getHttpServer().address();
  const puerto = typeof direccion === 'object' && direccion ? direccion.port : 0;
  return `http://127.0.0.1:${puerto}${ruta}`;
}

describe('política de acceso HTTP', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearApp('enforce');
  });

  afterAll(async () => {
    await app.close();
    delete process.env.ACCESS_POLICY_MODE;
  });

  test('health es público y responde JSON', async () => {
    const res = await fetch(await url(app, '/api/health'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
  });

  test('una ruta sin decorador responde 403 uniforme', async () => {
    const res = await fetch(await url(app, '/api/demo/sin-decorar'));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Acceso denegado',
      correlationId: expect.any(String),
    });
  });

  test('una ruta inexistente responde 403 uniforme y conserva el correlation ID', async () => {
    const res = await fetch(await url(app, '/api/no-existe'), {
      headers: { 'x-correlation-id': 'corr-12345678' },
    });
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(res.headers.get('x-correlation-id')).toBe('corr-12345678');
    expect(body.correlationId).toBe('corr-12345678');
  });

  test('una ruta de rol ADMIN exige el rol y no filtra detalles', async () => {
    const sinRol = await fetch(await url(app, '/api/demo/solo-admin'));
    expect(sinRol.status).toBe(403);

    const estudiante = await fetch(await url(app, '/api/demo/solo-admin'), {
      headers: { 'x-test-rol': 'ESTUDIANTE' },
    });
    expect(estudiante.status).toBe(403);

    const admin = await fetch(await url(app, '/api/demo/solo-admin'), {
      headers: { 'x-test-rol': 'ADMIN' },
    });
    expect(admin.status).toBe(200);
  });

  test('CORS rechaza orígenes no permitidos y acepta el preflight permitido', async () => {
    const prohibido = await fetch(await url(app, '/api/demo/publico'), {
      headers: { Origin: 'https://evil.example' },
    });
    expect(prohibido.status).toBe(403);
    expect(prohibido.headers.get('access-control-allow-origin')).toBeNull();

    const permitido = await fetch(await url(app, '/api/demo/publico'), {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:4200',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(permitido.status).toBe(204);
    expect(permitido.headers.get('access-control-allow-origin')).toBe('http://localhost:4200');
  });

  test('CORS acepta el mismo origen aunque no esté en la lista', async () => {
    const destino = await url(app, '/api/demo/publico');
    const res = await fetch(destino, {
      headers: { Origin: new URL(destino).origin },
    });
    expect(res.status).toBe(200);
  });
});

describe('modo audit', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearApp('audit');
  });

  afterAll(async () => {
    await app.close();
    delete process.env.ACCESS_POLICY_MODE;
  });

  test('permite una ruta sin decorador para poder auditarla', async () => {
    const res = await fetch(await url(app, '/api/demo/sin-decorar'));
    expect(res.status).toBe(200);
  });
});
