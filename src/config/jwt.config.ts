import { ConfigService } from '@nestjs/config';

const MIN_JWT_SECRET_LENGTH = 32;
const SECRETOS_INSEGUROS = new Set(['dev-secret', 'cambia-este-secreto-largo-y-aleatorio']);

export function getJwtSecret(config: ConfigService): string {
  const secret = (config.get<string>('JWT_SECRET') || '').trim();
  if (secret.length < MIN_JWT_SECRET_LENGTH || SECRETOS_INSEGUROS.has(secret)) {
    throw new Error(
      `JWT_SECRET es obligatorio, debe tener al menos ${MIN_JWT_SECRET_LENGTH} caracteres ` +
        'y no puede ser un valor de ejemplo. Configúralo en el .env antes de iniciar el backend.',
    );
  }
  return secret;
}
