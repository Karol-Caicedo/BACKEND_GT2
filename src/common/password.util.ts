import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';

/**
 * Parámetros OWASP para Argon2id:
 * 19 MiB de memoria, 2 iteraciones y paralelismo 1.
 */
export const ARGON2ID_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};

const ARGON2ID_PREFIX = '$argon2id$';
const BCRYPT_PREFIX = /^\$2[aby]\$/;

export function esHashArgon2id(hash: string | null | undefined): boolean {
  return typeof hash === 'string' && hash.startsWith(ARGON2ID_PREFIX);
}

export function esHashBcryptLegado(hash: string | null | undefined): boolean {
  return typeof hash === 'string' && BCRYPT_PREFIX.test(hash);
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2ID_OPTIONS);
}

function parametrosArgon2Debiles(hash: string): boolean {
  const match = /^\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(hash);
  if (!match) return true;
  const [, memoria, tiempo, paralelismo] = match.map(Number);
  return memoria < ARGON2ID_OPTIONS.memoryCost! ||
    tiempo < ARGON2ID_OPTIONS.timeCost! ||
    paralelismo < ARGON2ID_OPTIONS.parallelism!;
}

/**
 * Verifica una contraseña y señala si el hash debe actualizarse.
 * Acepta bcrypt legado para permitir una migración gradual y reversible.
 */
export async function verifyPassword(
  hash: string | null | undefined,
  password: string,
): Promise<{ valida: boolean; requiereRehash: boolean }> {
  if (!hash) return { valida: false, requiereRehash: false };

  if (esHashBcryptLegado(hash)) {
    try {
      return { valida: await bcrypt.compare(password, hash), requiereRehash: true };
    } catch {
      return { valida: false, requiereRehash: false };
    }
  }

  if (esHashArgon2id(hash)) {
    try {
      return {
        valida: await argon2.verify(hash, password),
        requiereRehash: parametrosArgon2Debiles(hash),
      };
    } catch {
      return { valida: false, requiereRehash: false };
    }
  }

  return { valida: false, requiereRehash: false };
}
