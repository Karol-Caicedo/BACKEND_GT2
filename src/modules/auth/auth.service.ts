import { createHash, randomBytes } from 'crypto';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { hashPassword, verifyPassword } from '../../common/password.util';
import { UsersService } from '../users/users.service';
import { toUsuarioSesion } from '../users/user-publico';
import { RegisterDto, CompleteSsoDto } from './auth.dto';
import { PasswordReset } from './password-reset.entity';
import { SsoCode } from './sso-code.entity';
import { hashSsoCode, SSO_CODE_TTL_MS } from './sso-code.util';
import { ResendService } from '../mail/resend.service';

export const RECUPERACION_TTL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
    @InjectRepository(PasswordReset) private resets: Repository<PasswordReset>,
    @InjectRepository(SsoCode) private ssoCodes: Repository<SsoCode>,
    private resend: ResendService,
  ) { }

  static hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  ssoEnabled() {
    return (this.config.get('AUTH_SSO_ENABLED', 'false') + '').trim().toLowerCase() === 'true';
  }

  private rehashEnLoginHabilitado() {
    return (this.config.get('PASSWORD_REHASH_ON_LOGIN', 'false') + '').trim().toLowerCase() === 'true';
  }

  private validarDominio(correo: string) {
    const dominio = this.config.get('ALLOWED_EMAIL_DOMAIN', '@gmail.com');
    if (!correo.toLowerCase().endsWith(dominio.toLowerCase())) {
      throw new BadRequestException(`Debe usar su correo institucional (${dominio})`);
    }
  }

  private firmar(user: { id: string; tokenVersion?: number }) {
    return {
      access_token: this.jwt.sign({
        sub: user.id,
        tokenVersion: user.tokenVersion ?? 0,
      }),
    };
  }

  @Cron('0 * * * *')
  async limpiarCodigosSsoVencidos() {
    await this.ssoCodes.delete({ expiraAt: LessThanOrEqual(new Date()) });
  }

  private async crearTokenTemporalSso(datos: {
    correo: string;
    nombre: string;
    proveedorId: string;
    proveedor: string;
  }) {
    const temp = randomBytes(32).toString('base64url');
    await this.ssoCodes.save(
      this.ssoCodes.create({
        codigoHash: hashSsoCode(temp),
        usuarioId: null,
        datos: { tipo: 'registro_pendiente', ...datos },
        expiraAt: new Date(Date.now() + 15 * 60 * 1000),
        usadoAt: null,
      }),
    );
    return temp;
  }

  async register(dto: RegisterDto) {
    this.validarDominio(dto.correo);
    const correo = dto.correo.toLowerCase();
    const existe = await this.users.findByCorreo(correo);
    if (existe) throw new BadRequestException('Este correo ya está registrado');
    const hash = await hashPassword(dto.password);
    const user = await this.users.create({
      correo,
      nombre: dto.nombre,
      passwordHash: hash,
      proveedorAuth: 'local',
      semestre: dto.semestre,
      rol: 'ESTUDIANTE',
      aceptoDatosAt: new Date(),
    });
    return this.firmar({
      id: user.id,
      tokenVersion: user.tokenVersion,
    });
  }

  async login(correo: string, password: string) {
    const user = await this.users.findByCorreo(correo);
    if (!user || !user.passwordHash) throw new UnauthorizedException('Credenciales inválidas');
    const { valida, requiereRehash } = await verifyPassword(user.passwordHash, password);
    if (!valida) throw new UnauthorizedException('Credenciales inválidas');

    // Migración gradual y reversible: solo se rehashea si se habilita por entorno.
    if (requiereRehash && this.rehashEnLoginHabilitado()) {
      user.passwordHash = await hashPassword(password);
      await this.users.save(user);
    }

    return this.firmar({
      id: user.id,
      tokenVersion: user.tokenVersion,
    });
  }

  async me(userId: string) {
    const u = await this.users.findById(userId);
    if (!u) throw new UnauthorizedException('No autenticado');
    return toUsuarioSesion(u);
  }

  async actualizarMiSemestre(userId: string, semestre: number) {
    if (!Number.isInteger(semestre) || semestre < 1 || semestre > 9) {
      throw new BadRequestException('Semestre inválido (1-9)');
    }
    const u = await this.users.findById(userId);
    if (!u) throw new UnauthorizedException('No autenticado');
    u.semestre = semestre;
    await this.users.save(u);
    return this.me(userId);
  }

  /** Flujo SSO: busca o crea usuario; si es nuevo retorna { necesitaCompletar: true, temp } */
  async loginSso(perfil: { correo: string; nombre: string; proveedorId: string }, proveedor: string) {
    if (!perfil.correo) throw new BadRequestException('La cuenta SSO no devolvió un correo válido');
    this.validarDominio(perfil.correo);
    let user = await this.users.findByCorreo(perfil.correo);
    if (!user) {
      // No se puede crear sin semestre + consentimiento: se emite token temporal
      const temp = await this.crearTokenTemporalSso({ ...perfil, proveedor });
      return { necesitaCompletar: true, temp };
    }
    if (!user.proveedorId) {
      user.proveedorId = perfil.proveedorId;
      user.proveedorAuth = proveedor;
      await this.users.save(user);
    }
    return {
      ...this.firmar({
        id: user.id,
        tokenVersion: user.tokenVersion,
      }),
      necesitaCompletar: false,
    };
  }

  /**
   * H-01: emite un código de un solo uso que viaja en cookie HttpOnly, nunca en
   * la URL. Solo se persiste su hash; el token de acceso se emite en el exchange.
   */
  async crearCodigoSso(perfil: { correo: string; nombre: string; proveedorId: string }, proveedor: string) {
    if (!perfil.correo) throw new BadRequestException('La cuenta SSO no devolvió un correo válido');
    this.validarDominio(perfil.correo);
    const user = await this.users.findByCorreo(perfil.correo);
    let usuarioId: string | null = null;
    let datos: Record<string, unknown> | null = null;

    if (user) {
      if (!user.proveedorId) {
        user.proveedorId = perfil.proveedorId;
        user.proveedorAuth = proveedor;
        await this.users.save(user);
      }
      usuarioId = user.id;
    } else {
      datos = {
        correo: perfil.correo,
        nombre: perfil.nombre,
        proveedorId: perfil.proveedorId,
        proveedor,
      };
    }

    const codigo = randomBytes(32).toString('base64url');
    await this.ssoCodes.save(
      this.ssoCodes.create({
        codigoHash: hashSsoCode(codigo),
        usuarioId,
        datos: datos ? { tipo: 'intercambio', ...datos } : null,
        expiraAt: new Date(Date.now() + SSO_CODE_TTL_MS),
        usadoAt: null,
      }),
    );
    return codigo;
  }

  /** Consume el código de forma atómica y emite la sesión o el token temporal. */
  async intercambiarCodigoSso(codigo: string) {
    if (!codigo) throw new BadRequestException('Código SSO ausente, inválido o vencido');
    const resultado = await this.ssoCodes
      .createQueryBuilder()
      .delete()
      .from(SsoCode)
      .where('"codigo_hash" = :hash AND "usado_at" IS NULL AND "expira_at" > now()', {
        hash: hashSsoCode(codigo),
      })
      .returning('*')
      .execute();

    if (!resultado.affected || !resultado.raw?.length) {
      throw new BadRequestException('El código SSO es inválido, ya fue usado o venció');
    }

    const fila = resultado.raw[0] as { usuario_id: string | null; datos: Record<string, unknown> | null };
    if (fila.usuario_id) {
      const user = await this.users.findById(fila.usuario_id);
      if (!user) throw new BadRequestException('El código SSO es inválido, ya fue usado o venció');
      return {
        ...this.firmar({
          id: user.id,
          tokenVersion: user.tokenVersion,
        }),
        necesitaCompletar: false,
      };
    }

    const datos = fila.datos || {};
    if (datos.tipo !== 'intercambio' || typeof datos.correo !== 'string' ||
      typeof datos.nombre !== 'string' || typeof datos.proveedorId !== 'string' ||
      typeof datos.proveedor !== 'string') {
      throw new BadRequestException('El código SSO es inválido, ya fue usado o venció');
    }
    const temp = await this.crearTokenTemporalSso({
      correo: datos.correo,
      nombre: datos.nombre,
      proveedorId: datos.proveedorId,
      proveedor: datos.proveedor,
    });
    return { necesitaCompletar: true, temp };
  }

  /**
   * Solicita recuperación de contraseña. Respuesta siempre genérica para no
   * revelar si el correo existe. Solo usuarios con clave local la reciben por correo.
   */
  async solicitarRecuperacion(correo: string) {
    const user = await this.users.findByCorreo((correo || '').trim());
    if (user) {
      await this.resets.update({ usuarioId: user.id, usadoAt: null }, { usadoAt: new Date() });
      const token = randomBytes(32).toString('hex');
      await this.resets.save(
        this.resets.create({
          usuarioId: user.id,
          tokenHash: AuthService.hashToken(token),
          expiraAt: new Date(Date.now() + RECUPERACION_TTL_MS),
          usadoAt: null,
        }),
      );
      const frontend = this.config.get('FRONTEND_URL', 'http://localhost:4200');
      const url = `${frontend.replace(/\/+$/, '')}/auth/restablecer`;
      try {
        await this.resend.enviarRecuperacion(user.correo, user.nombre, token, url);
      } catch (error) {
        // No se propaga: la respuesta debe ser idéntica exista o no el correo
        // (si fallara solo aquí, un atacante distinguiría cuentas registradas).
        // El detalle queda en el log para el administrador (ver ResendService).
        const logger = new Logger(AuthService.name);
        // Sin correo, nombre, URL ni token: los logs no deben permitir tomar la cuenta.
        logger.error('No se pudo enviar el correo de recuperación; revisa el proveedor de correo.');
      }
    }
    return { mensaje: 'Si el correo está registrado, recibirás un correo con instrucciones para restablecer tu contraseña.' };
  }

  /** Consume un token válido (una sola vez, 1h) y fija la nueva clave. */
  async restablecerClave(token: string, password: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }
    const registro = await this.resets.findOne({ where: { tokenHash: AuthService.hashToken(token || '') } });
    if (!registro || registro.usadoAt || registro.expiraAt.getTime() < Date.now()) {
      throw new BadRequestException('El código es inválido o ya venció. Solicita uno nuevo.');
    }
    const user = await this.users.findById(registro.usuarioId);
    if (!user) throw new BadRequestException('El código es inválido o ya venció. Solicita uno nuevo.');

    const consumido = await this.resets.update(
      {
        id: registro.id,
        usadoAt: IsNull(),
        expiraAt: MoreThan(new Date()),
      },
      { usadoAt: new Date() },
    );
    if (consumido.affected !== 1) {
      throw new BadRequestException('El código es inválido o ya venció. Solicita uno nuevo.');
    }

    user.passwordHash = await hashPassword(password);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    if (user.proveedorAuth !== 'local') user.proveedorAuth = 'local';
    await this.users.save(user);
    return { mensaje: 'Contraseña actualizada. Ya puedes ingresar con tu nueva clave.' };
  }

  async completarSso(tempToken: string, dto: CompleteSsoDto) {
    if (!tempToken) throw new BadRequestException('Token temporal inválido o vencido');
    const resultado = await this.ssoCodes
      .createQueryBuilder()
      .delete()
      .from(SsoCode)
      .where(`"codigo_hash" = :hash AND "usado_at" IS NULL AND "expira_at" > now() AND "datos"->>'tipo' = :tipo`, {
        hash: hashSsoCode(tempToken),
        tipo: 'registro_pendiente',
      })
      .returning('*')
      .execute();
    if (!resultado.affected || !resultado.raw?.length) {
      throw new BadRequestException('Token temporal inválido o vencido');
    }
    const datos = resultado.raw[0].datos as Record<string, unknown> | null;
    if (!datos || typeof datos.correo !== 'string' || typeof datos.nombre !== 'string' ||
      typeof datos.proveedorId !== 'string' || !['google', 'microsoft'].includes(String(datos.proveedor))) {
      throw new BadRequestException('Token temporal inválido o vencido');
    }
    const { correo, nombre, proveedorId, proveedor } = datos as {
      correo: string;
      nombre: string;
      proveedorId: string;
      proveedor: string;
    };
    this.validarDominio(correo);
    const existe = await this.users.findByCorreo(correo);
    if (existe) throw new BadRequestException('Este correo ya está registrado');
    const user = await this.users.create({
      correo,
      nombre,
      passwordHash: null,
      proveedorAuth: proveedor,
      proveedorId,
      semestre: dto.semestre,
      rol: 'ESTUDIANTE',
      aceptoDatosAt: new Date(),
    });
    return this.firmar({
      id: user.id,
      tokenVersion: user.tokenVersion,
    });
  }
}
