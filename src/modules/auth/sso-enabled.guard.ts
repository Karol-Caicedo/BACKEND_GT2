import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class SsoEnabledGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  canActivate(): boolean {
    if (!this.auth.ssoEnabled()) {
      throw new NotFoundException('El inicio de sesión institucional no está habilitado');
    }
    return true;
  }
}
