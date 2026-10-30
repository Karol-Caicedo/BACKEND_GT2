import { BadRequestException } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { detectarTipoImagen, eliminarImagen, guardarImagen } from './imagen.util';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
const TEXTO = Buffer.from('<script>alert(1)</script>');

function archivo(buffer: Buffer, mimetype: string): Express.Multer.File {
  return { buffer, mimetype, originalname: 'foto.jpg' } as Express.Multer.File;
}

describe('detectarTipoImagen', () => {
  test('detecta jpg, png y webp por firma', () => {
    expect(detectarTipoImagen(JPG)).toBe('jpg');
    expect(detectarTipoImagen(PNG)).toBe('png');
    expect(detectarTipoImagen(WEBP)).toBe('webp');
  });

  test('rechaza contenido arbitrario o buffer vacío', () => {
    expect(detectarTipoImagen(TEXTO)).toBeNull();
    expect(detectarTipoImagen(Buffer.alloc(0))).toBeNull();
    expect(detectarTipoImagen(undefined)).toBeNull();
  });
});

describe('guardarImagen', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sigice-img-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('ignora la extensión original y escribe con nombre aleatorio seguro', async () => {
    const url = await guardarImagen(archivo(PNG, 'image/png'), dir);
    expect(url).toMatch(/^\/api\/uploads\/[a-f0-9]{32}\.png$/);
    const contenido = await readFile(join(dir, url.replace('/api/uploads/', '')));
    expect(contenido.equals(PNG)).toBe(true);
  });

  test('rechaza contenido que no es imagen aunque el MIME lo simule', async () => {
    await expect(guardarImagen(archivo(TEXTO, 'image/jpeg'), dir)).rejects.toThrow(BadRequestException);
  });

  test('rechaza un MIME que no coincide con el contenido real', async () => {
    await expect(guardarImagen(archivo(PNG, 'image/jpeg'), dir)).rejects.toThrow(/no coincide/);
  });
});

describe('eliminarImagen', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sigice-img-del-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('elimina solo URLs internas con nombre seguro', async () => {
    const url = await guardarImagen(archivo(PNG, 'image/png'), dir);
    await eliminarImagen(url, dir);
    await expect(readFile(join(dir, url.replace('/api/uploads/', '')))).rejects.toThrow();

    await expect(eliminarImagen('../../.env', dir)).resolves.toBeUndefined();
    await expect(eliminarImagen('/api/uploads/../../.env', dir)).resolves.toBeUndefined();
    await expect(eliminarImagen(null, dir)).resolves.toBeUndefined();
  });
});
