import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from './current-user.decorator';

/**
 * Authorized organization id. ALWAYS derived from the authenticated session,
 * never from client input.
 */
export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
  return request.user.organizationId;
});
