import { createHash } from 'crypto';
import type { CookieOptions, Request } from 'express';

export const SSO_CODE_COOKIE = 'sigice_sso_code';
export const SSO_CODE_TTL_MS = 60_000;
export const SSO_CODE_PATH = '/api/auth/sso';

export function hashSsoCode(codigo: string): string {
  return createHash('sha256').update(codigo).digest('hex');
}

export function opcionesCookieSso(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SSO_CODE_TTL_MS,
    path: SSO_CODE_PATH,
  };
}

export function leerCookie(req: Pick<Request, 'headers'>, nombre: string): string | null {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const parte of header.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(resto.join('='));
  }
  return null;
}
