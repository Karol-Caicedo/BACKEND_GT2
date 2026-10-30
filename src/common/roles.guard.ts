import { CanActivate, ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessLogService } from './access-log.service';
import { AccessPolicyService } from './access-policy.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AppRole, ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly policy?: AccessPolicyService,
    @Optional() private readonly log?: AccessLogService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return false;

    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) === true) return true;

    const required = this.reflector.getAllAndOverride<AppRole[] | undefined>(ROLES_KEY, targets);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: { rol?: AppRole } }>();
    if (req.user && required.includes(req.user.rol as AppRole)) return true;

    this.log?.deniedContext(ctx, 'role_mismatch', { requiredRoles: required });
    return this.policy?.isAudit() ?? false;
  }
}
