import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';
import { OAuthStateStore } from './oauth-state.store';
import { getJwtSecret } from '../../config/jwt.config';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(config: ConfigService) {
    const tenant = config.get<string>('MICROSOFT_TENANT') || 'common';
    super({
      authorizationURL: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenURL: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      clientID: config.get<string>('MICROSOFT_CLIENT_ID') || 'disabled',
      clientSecret: config.get<string>('MICROSOFT_CLIENT_SECRET') || 'disabled',
      callbackURL: config.get<string>('MICROSOFT_CALLBACK_URL') || 'http://localhost:3000/api/auth/microsoft/callback',
      scope: ['User.Read'],
      store: new OAuthStateStore(getJwtSecret(config)),
    } as never);
  }
  async validate(accessToken: string): Promise<unknown> {
    // Obtiene el perfil desde Microsoft Graph con el access token
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = (await res.json()) as { id?: string; mail?: string; userPrincipalName?: string; displayName?: string };
    return {
      proveedorId: me.id,
      correo: (me.mail || me.userPrincipalName || '').toLowerCase(),
      nombre: me.displayName,
    };
  }
}
