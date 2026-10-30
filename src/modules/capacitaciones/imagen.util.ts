import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { rm, writeFile } from 'fs/promises';
import { join } from 'path';

export type TipoImagen = 'jpg' | 'png' | 'webp';

const MIME_POR_TIPO: Record<TipoImagen, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Detecta el tipo real por firma binaria, sin confiar en el MIME del cliente. */
export function detectarTipoImagen(buffer: Buffer | undefined): TipoImagen | null {
  if (!buffer || buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => buffer[i] === byte)) return 'png';

  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Valida el contenido real, fuerza una extensión segura y escribe con un
 * nombre aleatorio. Devuelve la URL pública relativa.
 */
export async function guardarImagen(
  file: Express.Multer.File,
  uploadsDir = process.env.UPLOADS_DIR || './uploads',
): Promise<string> {
  const tipo = detectarTipoImagen(file?.buffer);
  if (!tipo) {
    throw new BadRequestException('El archivo no es una imagen jpg, png o webp válida');
  }

  const mime = (file.mimetype || '').toLowerCase();
  const mimeEsperado = MIME_POR_TIPO[tipo];
  const mimeValido = mime === mimeEsperado || (tipo === 'jpg' && mime === 'image/jpg');
  if (!mimeValido) {
    throw new BadRequestException('El contenido de la imagen no coincide con su tipo');
  }

  const dir = uploadsDir.startsWith('/') ? uploadsDir : join(process.cwd(), uploadsDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const nombre = `${randomBytes(16).toString('hex')}.${tipo}`;
  await writeFile(join(dir, nombre), file.buffer);
  return `/api/uploads/${nombre}`;
}

/** Elimina una imagen recién guardada si la transacción de BD falla. */
export async function eliminarImagen(
  url: string | null | undefined,
  uploadsDir = process.env.UPLOADS_DIR || './uploads',
): Promise<void> {
  if (!url) return;
  const prefijo = '/api/uploads/';
  if (!url.startsWith(prefijo)) return;
  const nombre = url.slice(prefijo.length);
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(nombre)) return;
  const dir = uploadsDir.startsWith('/') ? uploadsDir : join(process.cwd(), uploadsDir);
  await rm(join(dir, nombre), { force: true });
}
