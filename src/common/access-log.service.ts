import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AccessPolicyService } from './access-policy.service';

type AccessRequest = Request & {
  user?: { id?: string; rol?: string };
  correlationId?: string;
};

@Injectable()
export class AccessLogService {
  private readonly logger = new Logger('AccessPolicy');

  constructor(private readonly policy: AccessPolicyService) {}

  deniedContext(ctx: ExecutionContext, reason: string, extra: Record<string, unknown> = {}) {
    if (ctx.getType() !== 'http') {
      this.logger.warn(JSON.stringify({
        event: 'access_denied',
        mode: this.policy.mode,
        reason,
        context: ctx.getType(),
        ...extra,
      }));
      return;
    }

    const req = ctx.switchToHttp().getRequest<AccessRequest>();
    req.accessDeniedLogged = true;
    req.accessDeniedReason = reason;
    this.deniedRequest(req, reason, extra);
  }

  deniedRequest(req: AccessRequest, reason: string, extra: Record<string, unknown> = {}) {
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    this.logger.warn(JSON.stringify({
      event: 'access_denied',
      mode: this.policy.mode,
      reason,
      method: req.method,
      path,
      ip: req.ip,
      userId: req.user?.id ?? null,
      rol: req.user?.rol ?? null,
      correlationId: req.correlationId ?? null,
      ...extra,
    }));
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
    accessDeniedLogged?: boolean;
    accessDeniedReason?: string;
  }
}
