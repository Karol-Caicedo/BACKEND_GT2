import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const FORMATO_VALIDO = /^[A-Za-z0-9._-]{8,128}$/;

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const recibido = req.header('x-correlation-id');
  const correlationId = recibido && FORMATO_VALIDO.test(recibido) ? recibido : randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}
