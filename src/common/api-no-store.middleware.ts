import type { NextFunction, Request, Response } from 'express';

export function apiNoStoreMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  if (path === '/api' || path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}
