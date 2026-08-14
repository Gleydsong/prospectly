import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, type Observable } from 'rxjs';

import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { runWithBypass, runWithTenant } from './tenant-context';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const organizationId = request.user?.organizationId;
    const userId = request.user?.id ?? null;

    if (isPublic || !organizationId) {
      return from(runWithBypass(() => lastValueFrom(next.handle())));
    }

    return from(runWithTenant(organizationId, () => lastValueFrom(next.handle()), userId));
  }
}
