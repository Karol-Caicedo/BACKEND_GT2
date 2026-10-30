import { HttpStatus } from '@nestjs/common';

const ERRORES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Payload Too Large',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

const MENSAJES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Solicitud inválida',
  [HttpStatus.UNAUTHORIZED]: 'No autenticado',
  [HttpStatus.FORBIDDEN]: 'Acceso denegado',
  [HttpStatus.NOT_FOUND]: 'Recurso no encontrado',
  [HttpStatus.CONFLICT]: 'Conflicto',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Archivo demasiado grande',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Demasiadas solicitudes',
};

export interface ErrorHttp {
  statusCode: number;
  error: string;
  message: string;
  correlationId: string;
}

export function cuerpoError(status: number, correlationId: string): ErrorHttp {
  return {
    statusCode: status,
    error: ERRORES[status] ?? (status >= 500 ? 'Internal Server Error' : 'Request Error'),
    message: MENSAJES[status] ?? (status >= 500 ? 'Error interno' : 'Solicitud rechazada'),
    correlationId,
  };
}
