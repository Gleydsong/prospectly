import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Role } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

interface AccessTokenPayload {
  sub: string;
  email: string;
  orgId: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    // Re-check membership so removed members lose access immediately.
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: payload.sub, organizationId: payload.orgId } },
    });
    if (!membership) {
      throw new UnauthorizedException('Membership revoked');
    }
    return {
      id: payload.sub,
      email: payload.email,
      organizationId: payload.orgId,
      role: membership.role,
    };
  }
}
