import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  privateDecrypt,
  type KeyObject,
} from 'crypto';
import { BadRequestException, Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto, LoginEnvelopeDto } from './auth.dto';
import { LoginChallenge } from './login-challenge.entity';

export const LOGIN_CHALLENGE_TTL_MS = 2 * 60 * 1000;
const AES_GCM_IV_BYTES = 12;
const AES_KEY_BYTES = 32;
const GCM_TAG_BYTES = 16;
const MAX_CIPHERTEXT_BYTES = 12 * 1024;
const KID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

type ClaveLogin = { privateKey: KeyObject; publicKey: string; wrappedKeyBytes: number };

function hashChallenge(challenge: string): string {
  return createHash('sha256').update(challenge).digest('hex');
}

function base64UrlBytes(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new BadRequestException('Sobre de inicio de sesión inválido o vencido');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value) throw new BadRequestException('Sobre de inicio de sesión inválido o vencido');
  return bytes;
}

function invalidEnvelope(): BadRequestException {
  return new BadRequestException('Sobre de inicio de sesión inválido o vencido');
}

@Injectable()
export class LoginCryptoService implements OnModuleInit {
  private keys = new Map<string, ClaveLogin>();
  private activeKeyId = '';

  constructor(
    private config: ConfigService,
    @InjectRepository(LoginChallenge) private challenges: Repository<LoginChallenge>,
  ) {}

  onModuleInit(): void {
    const activeKeyId = (this.config.get<string>('LOGIN_CRYPTO_ACTIVE_KEY_ID') || '').trim();
    const rawKeys = (this.config.get<string>('LOGIN_CRYPTO_KEYS_JSON') || '').trim();
    if (!activeKeyId || !KID_PATTERN.test(activeKeyId) || !rawKeys) {
      throw new Error('Configura LOGIN_CRYPTO_ACTIVE_KEY_ID y LOGIN_CRYPTO_KEYS_JSON antes de iniciar el backend.');
    }

    let encodedKeys: unknown;
    try {
      encodedKeys = JSON.parse(rawKeys);
    } catch {
      throw new Error('LOGIN_CRYPTO_KEYS_JSON debe ser un objeto JSON válido.');
    }
    if (!encodedKeys || typeof encodedKeys !== 'object' || Array.isArray(encodedKeys)) {
      throw new Error('LOGIN_CRYPTO_KEYS_JSON debe ser un objeto de identificadores y claves.');
    }

    const keys = new Map<string, ClaveLogin>();
    for (const [keyId, encodedPrivateKey] of Object.entries(encodedKeys)) {
      if (!KID_PATTERN.test(keyId) || typeof encodedPrivateKey !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedPrivateKey)) {
        throw new Error('LOGIN_CRYPTO_KEYS_JSON contiene una entrada inválida.');
      }
      try {
        const privateKey = createPrivateKey({
          key: Buffer.from(encodedPrivateKey, 'base64'),
          format: 'der',
          type: 'pkcs8',
        });
        const modulusLength = privateKey.asymmetricKeyDetails?.modulusLength ?? 0;
        const publicExponent = privateKey.asymmetricKeyDetails?.publicExponent;
        if (privateKey.asymmetricKeyType !== 'rsa' || modulusLength < 3072 || publicExponent !== 65537n) {
          throw new Error('Unsupported key type or size');
        }
        const publicKey = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('base64');
        keys.set(keyId, {
          privateKey,
          publicKey,
          wrappedKeyBytes: Math.ceil(modulusLength / 8),
        });
      } catch {
        throw new Error(`La clave privada configurada para ${keyId} no es PKCS#8 RSA válida de al menos 3072 bits.`);
      }
    }
    if (!keys.has(activeKeyId)) {
      throw new Error('LOGIN_CRYPTO_ACTIVE_KEY_ID no existe en LOGIN_CRYPTO_KEYS_JSON.');
    }
    this.keys = keys;
    this.activeKeyId = activeKeyId;
  }

  private esTablaFaltante(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (error as QueryFailedError & { driverError?: { code?: string } }).driverError;
    const codigo = driverError?.code ?? '';
    return codigo === '42P01' || /relation .* does not exist/i.test(error.message ?? '');
  }

  private async conTablaDisponible<T>(operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (error) {
      if (this.esTablaFaltante(error)) {
        throw new ServiceUnavailableException('El inicio de sesión seguro no está disponible');
      }
      throw error;
    }
  }

  async crearParametros(): Promise<{ version: 1; keyId: string; publicKey: string; challenge: string; expiresIn: number }> {
    const key = this.keys.get(this.activeKeyId);
    if (!key) throw new ServiceUnavailableException('El inicio de sesión seguro no está disponible');

    return this.conTablaDisponible(async () => {
      const challenge = randomBytes(32).toString('base64url');
      const expiraAt = new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS);
      await this.challenges.save(
        this.challenges.create({
          challengeHash: hashChallenge(challenge),
          keyId: this.activeKeyId,
          expiraAt,
        }),
      );
      return {
        version: 1,
        keyId: this.activeKeyId,
        publicKey: key.publicKey,
        challenge,
        expiresIn: LOGIN_CHALLENGE_TTL_MS / 1000,
      };
    });
  }

  async descifrar(envelope: LoginEnvelopeDto): Promise<LoginDto> {
    if (
      !envelope ||
      typeof envelope !== 'object' ||
      envelope.version !== 1 ||
      !KID_PATTERN.test(envelope.keyId) ||
      !/^[A-Za-z0-9_-]{43}$/.test(envelope.challenge)
    ) {
      throw invalidEnvelope();
    }
    const key = this.keys.get(envelope.keyId);
    if (!key) throw invalidEnvelope();

    const wrappedKey = base64UrlBytes(envelope.wrappedKey);
    const iv = base64UrlBytes(envelope.iv);
    const ciphertextAndTag = base64UrlBytes(envelope.ciphertext);
    if (
      wrappedKey.length !== key.wrappedKeyBytes ||
      iv.length !== AES_GCM_IV_BYTES ||
      ciphertextAndTag.length < GCM_TAG_BYTES + 2 ||
      ciphertextAndTag.length > MAX_CIPHERTEXT_BYTES
    ) {
      throw invalidEnvelope();
    }

    let consumido: { affected?: number };
    try {
      consumido = await this.challenges
        .createQueryBuilder()
        .delete()
        .from(LoginChallenge)
        .where('"challenge_hash" = :hash AND "key_id" = :keyId AND "expira_at" > now()', {
          hash: hashChallenge(envelope.challenge),
          keyId: envelope.keyId,
        })
        .returning('"challenge_hash"')
        .execute();
    } catch (error) {
      if (this.esTablaFaltante(error)) {
        throw new ServiceUnavailableException('El inicio de sesión seguro no está disponible');
      }
      throw invalidEnvelope();
    }
    if (!consumido.affected) throw invalidEnvelope();

    let cleartext: Buffer | undefined;
    let aesKey: Buffer | undefined;
    try {
      aesKey = privateDecrypt(
        {
          key: key.privateKey,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        wrappedKey,
      );
      if (aesKey.length !== AES_KEY_BYTES) throw invalidEnvelope();

      const aad = Buffer.from(`sigice-login:v1:${envelope.keyId}:${envelope.challenge}`, 'utf8');
      const ciphertext = ciphertextAndTag.subarray(0, -GCM_TAG_BYTES);
      const authTag = ciphertextAndTag.subarray(-GCM_TAG_BYTES);
      const decipher = createDecipheriv('aes-256-gcm', aesKey, iv, { authTagLength: GCM_TAG_BYTES });
      decipher.setAAD(aad);
      decipher.setAuthTag(authTag);
      cleartext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      const payload: unknown = JSON.parse(cleartext.toString('utf8'));
      if (
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        Object.keys(payload).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(payload, 'correo') ||
        !Object.prototype.hasOwnProperty.call(payload, 'password')
      ) {
        throw invalidEnvelope();
      }
      const dto = plainToInstance(LoginDto, payload);
      if ((await validate(dto, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true })).length) {
        throw invalidEnvelope();
      }
      return dto;
    } catch {
      throw invalidEnvelope();
    } finally {
      cleartext?.fill(0);
      aesKey?.fill(0);
    }
  }

  @Cron('*/10 * * * *')
  async limpiarDesafiosVencidos(): Promise<void> {
    try {
      await this.challenges.delete({ expiraAt: LessThanOrEqual(new Date()) });
    } catch (error) {
      if (!this.esTablaFaltante(error)) {
        throw error;
      }
    }
  }
}
