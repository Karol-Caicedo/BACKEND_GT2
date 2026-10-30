import { ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AccessPolicyService } from './access-policy.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly policy?: AccessPolicyService,
  ) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    if (ctx.getType() !== 'http') return false;

    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic === true) return true;

    const roles = this.reflector.getAllAndOverride<unknown[] | undefined>(ROLES_KEY, targets);
    if (roles === undefined && this.policy?.isAudit()) return true;

    return super.canActivate(ctx);
  }
}
