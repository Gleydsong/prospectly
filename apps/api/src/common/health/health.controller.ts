import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiTags } from '@nestjs/swagger';
import type { Queue } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../decorators/public.decorator';

export const HEALTH_REDIS_QUEUE = 'health-readiness';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(HEALTH_REDIS_QUEUE) private readonly queue: Queue,
  ) {}

  @Public()
  @Get()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('live')
  liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready' });
    }

    try {
      const redis = (await this.queue.client) as unknown as { ping(): Promise<string> };
      await redis.ping();
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready' });
    }

    return { status: 'ready', timestamp: new Date().toISOString() };
  }
}
