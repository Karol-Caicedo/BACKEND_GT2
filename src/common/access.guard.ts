import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessLogService } from './access-log.service';
import { AccessPolicyService } from './access-policy.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AppRole, ROLES_KEY } from './roles.decorator';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: AccessPolicyService,
    private readonly log: AccessLogService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') {
      this.log.deniedContext(ctx, 'non_http_context');
      return false;
    }

    try {
      const targets = [ctx.getHandler(), ctx.getClass()];
      if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) === true) return true;

      const roles = this.reflector.getAllAndOverride<AppRole[] | undefined>(ROLES_KEY, targets);
      if (roles !== undefined) return true;

      this.log.deniedContext(ctx, 'missing_access_decorator');
      return this.policy.isAudit();
    } catch {
      this.log.deniedContext(ctx, 'access_policy_error');
      return false;
    }
  }
}
