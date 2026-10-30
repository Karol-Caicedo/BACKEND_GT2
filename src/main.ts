import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { NextFunction, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { User } from './modules/users/user.entity';
import { ejecutarSeed } from './seed';
import { AccessLogService } from './common/access-log.service';
import { AccessPolicyService } from './common/access-policy.service';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { correlationIdMiddleware } from './common/correlation-id.middleware';
import { corsOriginGuard } from './common/cors-origin.middleware';
import { cuerpoError } from './common/http-error';
import { tuberíaValidacionHttp } from './common/validacion-http';
import { apiNoStoreMiddleware } from './common/api-no-store.middleware';

async function asegurarDatosIniciales(app: NestExpressApplication): Promise<void> {
  const produccion = (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  if (!produccion) return;

  const ds = app.get(DataSource);
  const totalUsuarios = await ds.getRepository(User).count();
  if (totalUsuarios > 0) {
    // eslint-disable-next-line no-console
    console.log(`[seed] Usuarios existentes: ${totalUsuarios}. No se ejecuta el seed inicial.`);
    return;
  }
  if (!(process.env.ADMIN_PASSWORD || '').trim()) {
    // eslint-disable-next-line no-console
    console.warn('[seed] Base de datos sin usuarios y ADMIN_PASSWORD no configurado. Define ADMIN_PASSWORD y redespliega.');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[seed] Base de datos sin usuarios: ejecutando seed inicial...');
  try {
    await ejecutarSeed(ds);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[seed] No se pudo ejecutar el seed inicial:', error instanceof Error ? error.message : error);
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const accessLog = app.get(AccessLogService);

  app.disable('x-powered-by');
  app.set('trust proxy', Number(config.get('TRUST_PROXY', 1)));
  app.use(correlationIdMiddleware);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(apiNoStoreMiddleware);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(tuberíaValidacionHttp());
  app.useGlobalFilters(new AllExceptionsFilter(app.get(AccessPolicyService)));

  const frontendUrls = String(config.get('FRONTEND_URL', 'http://localhost:4200'))
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
    .map((o) => o.replace(/\/+$/, ''));
  const allowedOrigins = new Set([...frontendUrls, 'http://localhost:4200']);
  app.use(corsOriginGuard(allowedOrigins, accessLog));
  app.enableCors({
    origin: [...allowedOrigins],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    exposedHeaders: ['X-Correlation-Id'],
    maxAge: 600,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/uploads' || req.path.startsWith('/uploads/')) {
      accessLog.deniedRequest(req, 'legacy_upload_blocked');
      return res.status(403).json(cuerpoError(403, req.correlationId ?? ''));
    }
    next();
  });

  const uploadsDir = config.get<string>('UPLOADS_DIR', './uploads');
  const abs = uploadsDir.startsWith('/') ? uploadsDir : join(process.cwd(), uploadsDir);
  if (!existsSync(abs)) mkdirSync(abs, { recursive: true });

  // Despliegue de un solo servicio: servir el frontend Angular compilado.
  // En desarrollo local la carpeta no existe y se ignora sin errores.
  const webDir = [
    join(process.cwd(), 'frontend', 'dist', 'app', 'browser'),
    join(process.cwd(), '..', 'frontend', 'dist', 'app', 'browser'),
  ].find((d) => existsSync(join(d, 'index.html')));

  const swaggerDefault = 'true';
  const swaggerEnabled = (config.get('ENABLE_SWAGGER', swaggerDefault) + '').toLowerCase() === 'true';
  if (swaggerEnabled) {
    const docConfig = new DocumentBuilder()
      .setTitle('SIGICE API')
      .setDescription('API del programa de Ingeniería de Sistemas (Proyección Social)')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup('api/docs', app, doc);

    // Rutas cortas para encontrar la documentación; la raíz solo redirige si no hay frontend.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') return next();
      const ruta = req.path.replace(/\/+$/, '') || '/';
      const esAccesoDirecto = ruta === '/docs' || ruta === '/api-docs' || ruta === '/api';
      if (esAccesoDirecto || (!webDir && ruta === '/')) {
        return res.redirect(302, '/api/docs');
      }
      next();
    });
  }

  if (webDir) {
    app.useStaticAssets(webDir, { index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(join(webDir, 'index.html'));
    });
    // eslint-disable-next-line no-console
    console.log(`Sirviendo frontend desde ${webDir}`);
  }

  await asegurarDatosIniciales(app);

  const port = Number(config.get('PORT', 3000));
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend escuchando en http://localhost:${port}/api - docs en http://localhost:${port}/api/docs`);
}
bootstrap();
