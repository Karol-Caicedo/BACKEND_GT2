import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccessPolicyService } from './access-policy.service';
import { cuerpoError } from './http-error';
import { detalleErrorParaLog } from './log-seguro';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  constructor(@Optional() private readonly policy?: AccessPolicyService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const correlationId = req.correlationId ?? '';
    const path = String(req.originalUrl || req.url || '').split('?')[0];

    if (status >= 500) {
      const detalle = detalleErrorParaLog(exception);
      this.logger.error(JSON.stringify({
        event: 'http_error',
        status,
        method: req.method,
        path,
        correlationId,
        error: detalle.message,
      }), detalle.stack);
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      this.logger.warn(JSON.stringify({
        event: 'http_unauthorized',
        status,
        method: req.method,
        path,
        correlationId,
      }));
    }

    if (status === HttpStatus.FORBIDDEN && !req.accessDeniedLogged) {
      this.logger.warn(JSON.stringify({
        event: 'access_denied',
        mode: this.policy?.mode ?? 'enforce',
        reason: req.accessDeniedReason ?? 'exception',
        method: req.method,
        path,
        ip: req.ip,
        userId: (req as Request & { user?: { id?: string } }).user?.id ?? null,
        correlationId,
      }));
    }

    if (res.headersSent) return;
    res.status(status).json(cuerpoError(status, correlationId));
  }
}
