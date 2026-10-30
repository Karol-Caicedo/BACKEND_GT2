import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AccessLogService } from './common/access-log.service';
import { AccessPolicyService } from './common/access-policy.service';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { correlationIdMiddleware } from './common/correlation-id.middleware';
import { corsOriginGuard } from './common/cors-origin.middleware';
import { cuerpoError } from './common/http-error';
import { tuberíaValidacionHttp } from './common/validacion-http';
import { apiNoStoreMiddleware } from './common/api-no-store.middleware';

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
  }

  const port = Number(config.get('PORT', 3000));
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend escuchando en http://localhost:${port}/api - docs en /api/docs`);
}
bootstrap();
