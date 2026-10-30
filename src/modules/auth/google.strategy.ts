import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { OAuthStateStore } from './oauth-state.store';
import { getJwtSecret } from '../../config/jwt.config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'disabled',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'disabled',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/api/auth/google/callback',
      scope: ['email', 'profile'],
      store: new OAuthStateStore(getJwtSecret(config)),
    } as never);
  }
  async validate(
    _a: string,
    _r: string,
    profile: {
      id: string;
      emails?: { value: string; verified?: boolean }[];
      displayName?: string;
      _json?: { email_verified?: boolean };
    },
  ) {
    const email = profile.emails?.find((e) => e.value);
    const verificado = email?.verified ?? profile._json?.email_verified;
    if (verificado === false) {
      throw new UnauthorizedException('La cuenta de Google no tiene el correo verificado');
    }
    return {
      proveedorId: profile.id,
      correo: email?.value?.toLowerCase(),
      nombre: profile.displayName || email?.value,
    };
  }
}
