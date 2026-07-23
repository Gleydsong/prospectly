import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { HEALTH_REDIS_QUEUE, HealthController } from './health.controller';

@Module({
  imports: [BullModule.registerQueue({ name: HEALTH_REDIS_QUEUE })],
  controllers: [HealthController],
})
export class HealthModule {}
