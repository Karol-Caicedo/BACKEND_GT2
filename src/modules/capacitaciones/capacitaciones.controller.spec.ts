import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from '../../common/all-exceptions.filter';
import { CapacitacionesController } from './capacitaciones.controller';
import { CapacitacionesService } from './capacitaciones.service';
import { MailService } from '../mail/mail.service';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const servicio = {
  detallePara: jest.fn().mockResolvedValue({ id: 'mock' }),
  registrarClic: jest.fn().mockResolvedValue({ enlace: 'https://x.co' }),
  crear: jest.fn().mockResolvedValue({ id: 'mock' }),
  actualizar: jest.fn().mockResolvedValue({ id: 'mock' }),
  eliminar: jest.fn().mockResolvedValue({ ok: true }),
  detalle: jest.fn().mockResolvedValue({ id: 'mock', titulo: 'T', descripcion: 'D', modalidad: 'virtual', enlace: 'https://x.co' }),
  destinatarios: jest.fn().mockResolvedValue([]),
};

@Module({
  controllers: [CapacitacionesController],
  providers: [
    { provide: CapacitacionesService, useValue: servicio },
    { provide: MailService, useValue: { enviar: jest.fn().mockResolvedValue({ simulado: true }) } },
  ],
})
class CapacitacionesTestModule {}

describe('H-04 capacitaciones: IDs inválidos', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    app = await NestFactory.create(CapacitacionesTestModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0);
    const direccion = app.getHttpServer().address();
    const puerto = typeof direccion === 'object' && direccion ? direccion.port : 0;
    base = `http://127.0.0.1:${puerto}/api/capacitaciones`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['GET', '/no-es-uuid'],
    ['PATCH', '/no-es-uuid'],
    ['DELETE', '/no-es-uuid'],
    ['POST', '/no-es-uuid/clic'],
    ['POST', '/no-es-uuid/notificar'],
  ])('%s %s responde 400 sin llamar al servicio', async (metodo, ruta) => {
    const res = await fetch(`${base}${ruta}`, { method: metodo });
    expect(res.status).toBe(400);
    expect(servicio.detallePara).not.toHaveBeenCalled();
    expect(servicio.registrarClic).not.toHaveBeenCalled();
    expect(servicio.actualizar).not.toHaveBeenCalled();
    expect(servicio.eliminar).not.toHaveBeenCalled();
    expect(servicio.detalle).not.toHaveBeenCalled();
  });

  test.each([
    ['estado inventado', { estado: 'inventado' }],
    ['semestres duplicados', { semestres: [4, 4] }],
    ['semestres fuera de rango', { semestres: [10] }],
    ['fecha inválida', { fechaEvento: 'no-es-fecha' }],
    ['campo no permitido', { createdBy: '123e4567-e89b-42d3-a456-426614174000' }],
  ])('PATCH rechaza %s con 400', async (_caso, body) => {
    const res = await fetch(`${base}/123e4567-e89b-42d3-a456-426614174000`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(400);
    expect(servicio.actualizar).not.toHaveBeenCalled();
  });
});

describe('H-01 limpieza de imagen si falla la transacción', () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const archivo = { buffer: PNG, mimetype: 'image/png', originalname: 'foto.png' } as Express.Multer.File;
  let dir = '';
  let anterior = '';
  let ctrl: CapacitacionesController;

  beforeEach(async () => {
    anterior = process.env.UPLOADS_DIR ?? '';
    dir = await mkdtemp(join(tmpdir(), 'sigice-cap-'));
    process.env.UPLOADS_DIR = dir;
    ctrl = new CapacitacionesController(servicio as unknown as CapacitacionesService, { enviar: jest.fn() } as unknown as MailService);
  });

  afterEach(async () => {
    if (anterior) process.env.UPLOADS_DIR = anterior;
    else delete process.env.UPLOADS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  test('crear: borra el archivo recién guardado si el servicio falla', async () => {
    servicio.crear.mockRejectedValueOnce(new Error('fallo BD'));
    await expect(ctrl.crear({ titulo: 'T' } as never, archivo, { user: { id: 'admin-1' } })).rejects.toThrow('fallo BD');
    await expect(readdir(dir)).resolves.toEqual([]);
  });

  test('actualizar: borra el archivo recién guardado si el servicio falla', async () => {
    servicio.actualizar.mockRejectedValueOnce(new Error('fallo BD'));
    await expect(ctrl.actualizar('123e4567-e89b-42d3-a456-426614174000', { titulo: 'T' } as never, archivo)).rejects.toThrow('fallo BD');
    await expect(readdir(dir)).resolves.toEqual([]);
  });
});
