import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class AssistantSpikeGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Check feature flag (default disabled)
    const enabled =
      this.config.get<string>('ASSISTANT_SPIKE_ENABLED') === 'true' ||
      this.config.get<boolean>('assistantSpike.enabled') === true;

    if (!enabled) {
      throw new NotFoundException('Assistant spike is disabled');
    }

    // 2. Reject JWT in query string explicitly to prevent token leakage in URLs
    const query = request.query ?? {};
    if (
      typeof query.token === 'string' ||
      typeof query.jwt === 'string' ||
      typeof query.access_token === 'string'
    ) {
      throw new UnauthorizedException(
        'JWT in query string is forbidden; use Authorization header',
      );
    }

    return true;
  }
}
