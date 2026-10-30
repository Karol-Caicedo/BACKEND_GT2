import type { NextFunction, Request, Response } from 'express';
import { AccessLogService } from './access-log.service';
import { cuerpoError } from './http-error';

export function corsOriginGuard(allowedOrigins: Set<string>, accessLog: AccessLogService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const sameOrigin = origin === `${req.protocol}://${req.get('host')}`;
    if (origin && !sameOrigin && !allowedOrigins.has(origin)) {
      accessLog.deniedRequest(req, 'cors_origin_not_allowed', { origin });
      return res.status(403).json(cuerpoError(403, req.correlationId ?? ''));
    }
    next();
  };
}
