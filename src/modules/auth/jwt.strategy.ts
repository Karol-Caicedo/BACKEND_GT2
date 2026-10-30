import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { getJwtSecret } from '../../config/jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: getJwtSecret(config),
      algorithms: ['HS256'],
    });
  }
  async validate(payload: { sub: string; tokenVersion?: number }) {
    const user = await this.users.findById(payload.sub);
    if (!user) return null;
    if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) return null;
    return { id: user.id, correo: user.correo, rol: user.rol, semestre: user.semestre, nombre: user.nombre };
  }
}
