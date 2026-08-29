import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

import { OPS_METRICS_TOKEN_HEADER, OPS_METRICS_TOKEN_MIN_LENGTH } from './ops-metrics.constants';

function headerValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return raw;
}

function equalSecrets(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Injectable()
export class OpsMetricsGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ops.metricsToken')?.trim() ?? '';
    if (expected.length < OPS_METRICS_TOKEN_MIN_LENGTH) {
      throw new NotFoundException();
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const provided = headerValue(request.headers[OPS_METRICS_TOKEN_HEADER]);
    if (!provided || !equalSecrets(provided, expected)) {
      throw new UnauthorizedException('Invalid ops metrics token');
    }
    return true;
  }
}
