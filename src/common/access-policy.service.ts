import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AccessPolicyMode = 'audit' | 'enforce';

@Injectable()
export class AccessPolicyService {
  private readonly logger = new Logger(AccessPolicyService.name);
  readonly mode: AccessPolicyMode;

  constructor(config: ConfigService) {
    const configured = String(config.get('ACCESS_POLICY_MODE') ?? '').trim().toLowerCase();
    const fallback: AccessPolicyMode = config.get('NODE_ENV') === 'staging' ? 'audit' : 'enforce';

    if (configured && configured !== 'audit' && configured !== 'enforce') {
      this.logger.warn(`ACCESS_POLICY_MODE inválido (${configured}); se usará ${fallback}`);
    }

    this.mode = configured === 'audit' || configured === 'enforce' ? configured : fallback;
  }

  isAudit(): boolean {
    return this.mode === 'audit';
  }
}
