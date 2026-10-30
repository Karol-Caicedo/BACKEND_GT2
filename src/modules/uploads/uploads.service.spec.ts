import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Response } from 'express';
import { CapacitacionesService } from '../capacitaciones/capacitaciones.service';
import { UploadsService } from './uploads.service';

const NOMBRE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90.png';

function respuesta(): Response {
  return {
    headersSent: false,
    setHeader: jest.fn(),
    type: jest.fn(),
    sendFile: jest.fn((_archivo: string, _opciones: unknown, cb: (err?: Error) => void) => cb()),
    end: jest.fn(),
  } as unknown as Response;
}

describe('UploadsService', () => {
  let dir = '';
  let repo: { findOne: jest.Mock };
  let caps: { puedeVer: jest.Mock };
  let svc: UploadsService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sigice-uploads-'));
    repo = { findOne: jest.fn() };
    caps = { puedeVer: jest.fn() };
    svc = new UploadsService(
      new ConfigService({ UPLOADS_DIR: dir }),
      caps as unknown as CapacitacionesService,
      repo as never,
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('rechaza nombres fuera del formato seguro sin consultar la base', async () => {
    await expect(svc.enviar('../../.env', { id: 'u', rol: 'ADMIN', semestre: 1 }, respuesta()))
      .rejects.toThrow(NotFoundException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  test('oculta imágenes inexistentes o no asociadas a una capacitación', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.enviar(NOMBRE, { id: 'u', rol: 'ADMIN', semestre: 1 }, respuesta()))
      .rejects.toThrow(NotFoundException);
  });

  test('niega la imagen si el estudiante no puede ver la capacitación', async () => {
    repo.findOne.mockResolvedValue({ id: 'cap-1' });
    caps.puedeVer.mockResolvedValue(false);
    await expect(svc.enviar(NOMBRE, { id: 'u', rol: 'ESTUDIANTE', semestre: 1 }, respuesta()))
      .rejects.toThrow(NotFoundException);
  });

  test('sirve la imagen sin almacenarla en caché cuando el recurso es visible', async () => {
    const archivo = join(dir, NOMBRE);
    await writeFile(archivo, Buffer.from('png'));
    repo.findOne.mockResolvedValue({ id: 'cap-1' });
    caps.puedeVer.mockResolvedValue(true);
    const res = respuesta();

    await expect(svc.enviar(NOMBRE, { id: 'u', rol: 'ESTUDIANTE', semestre: 5 }, res)).resolves.toBeUndefined();

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.sendFile).toHaveBeenCalled();
    expect((res.sendFile as jest.Mock).mock.calls[0][1]).toMatchObject({ cacheControl: false });
  });
});
