import { applyDecorators } from '@nestjs/common';
import { Roles, AppRole } from './roles.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

export function Auth(...roles: AppRole[]) {
  return applyDecorators(
    ApiBearerAuth(),
    Roles(...roles),
  );
}
