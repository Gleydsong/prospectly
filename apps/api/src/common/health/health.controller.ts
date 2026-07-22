import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../decorators/public.decorator';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
      return { status: 'ready', database: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'down' });
    }
  }
}
