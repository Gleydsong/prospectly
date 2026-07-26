import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { REQUIRE_EMAIL_VERIFIED_KEY } from '../decorators/require-email-verified.decorator';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_EMAIL_VERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email verification required',
      });
    }

    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerifiedAt: true },
    });
    if (!row?.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email verification required',
      });
    }
    return true;
  }
}
