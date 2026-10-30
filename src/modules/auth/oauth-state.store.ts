import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';

const COOKIE = 'sigice_oauth_state';
const COOKIE_PATH = '/api/auth';
const MAX_AGE_MS = 10 * 60 * 1000;

function hmac(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function leerCookie(req: Request, nombre: string): string | null {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const parte of header.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(resto.join('='));
  }
  return null;
}

function iguales(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * State OAuth sin sesión de servidor: nonce firmado con HMAC y enviado como
 * cookie HttpOnly. El callback exige que `state` y cookie coincidan.
 */
export class OAuthStateStore {
  constructor(private secret: string) {}

  store(
    req: Request,
    _state: string | undefined,
    _meta: unknown,
    cb: (err: Error | null, handle?: string) => void,
  ) {
    const res = req.res as Response | undefined;
    if (!res) return cb(new Error('No se pudo iniciar el flujo OAuth sin respuesta HTTP'));

    const nonce = randomBytes(24).toString('base64url');
    const handle = `${nonce}.${hmac(this.secret, nonce)}`;
    res.cookie(COOKIE, handle, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: MAX_AGE_MS,
      path: COOKIE_PATH,
    });
    cb(null, handle);
  }

  verify(
    req: Request,
    providedState: string | undefined,
    cb: (err: Error | null, ok?: boolean, info?: unknown) => void,
  ) {
    const res = req.res as Response | undefined;
    res?.clearCookie(COOKIE, { path: COOKIE_PATH });

    const cookie = leerCookie(req, COOKIE);
    if (!cookie || !providedState || !iguales(cookie, providedState)) {
      return cb(null, false, { message: 'No se pudo verificar el estado de la autorización' });
    }

    const [nonce, firma] = cookie.split('.');
    if (!nonce || !firma || !iguales(firma, hmac(this.secret, nonce))) {
      return cb(null, false, { message: 'Estado de autorización inválido' });
    }

    return cb(null, true);
  }
}
