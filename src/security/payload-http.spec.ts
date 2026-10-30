import { Body, Controller, Get, INestApplication, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { Public } from '../common/public.decorator';
import { tuberíaValidacionHttp } from '../common/validacion-http';
import { apiNoStoreMiddleware } from '../common/api-no-store.middleware';
import { LoginEnvelopeDto } from '../modules/auth/auth.dto';

@Controller('demo-cred')
class DemoCredController {
  @Post('login')
  @Public()
  login(@Body() dto: LoginEnvelopeDto) {
    return { ok: true, version: dto.version };
  }

  @Get('boom')
  @Public()
  boom() {
    throw new Error('interno password=ClaveSecreta token=abc.def');
  }
}

@Module({ controllers: [DemoCredController] })
class DemoCredModule {}

async function crearApp(): Promise<INestApplication> {
  const app = await NestFactory.create(DemoCredModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use(apiNoStoreMiddleware);
  app.useGlobalPipes(tuberíaValidacionHttp());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0);
  return app;
}

async function url(app: INestApplication, ruta: string): Promise<string> {
  const direccion = app.getHttpServer().address();
  const puerto = typeof direccion === 'object' && direccion ? direccion.port : 0;
  return `http://127.0.0.1:${puerto}${ruta}`;
}

describe('payloads HTTP y secretos', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  test('el login acepta solo el sobre cifrado y no lo devuelve', async () => {
    const res = await fetch(await url(app, '/api/demo-cred/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 1,
        keyId: 'rsa-test',
        challenge: 'A'.repeat(43),
        wrappedKey: 'A'.repeat(512),
        iv: 'A'.repeat(16),
        ciphertext: 'A'.repeat(64),
      }),
    });
    const texto = await res.text();
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(texto).not.toContain('correo');
    expect(texto).not.toContain('password');
    expect(JSON.parse(texto)).toEqual({ ok: true, version: 1 });
  });

  test('un 400 rechaza los campos originales sin reproducirlos', async () => {
    const res = await fetch(await url(app, '/api/demo-cred/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'no-es-correo', password: 'ClaveUnicaDePrueba-xyz' }),
    });
    const texto = await res.text();
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(texto).not.toContain('ClaveUnicaDePrueba-xyz');
    expect(texto).not.toContain('no-es-correo');
    expect(JSON.parse(texto)).toMatchObject({
      statusCode: 400,
      message: 'Solicitud inválida',
    });
  });

  test('un 500 no devuelve stack ni secretos', async () => {
    const res = await fetch(await url(app, '/api/demo-cred/boom'));
    const texto = await res.text();
    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(texto).not.toContain('ClaveSecreta');
    expect(texto).not.toContain('abc.def');
    expect(texto).not.toMatch(/at /);
    expect(JSON.parse(texto)).toMatchObject({
      statusCode: 500,
      message: 'Error interno',
    });
  });
});
