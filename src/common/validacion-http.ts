import { BadRequestException, ValidationPipe } from '@nestjs/common';

/** Validación global: no incluye valores enviados por el cliente en la excepción. */
export function tuberíaValidacionHttp(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: () => new BadRequestException('Solicitud inválida'),
  });
}
