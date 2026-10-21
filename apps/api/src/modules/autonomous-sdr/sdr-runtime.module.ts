import { Module } from '@nestjs/common';

import { SuppressionModule } from '../privacy/suppression.module';
import { AgentsModule } from '../agents/agents.module';
import { SdrJevClient } from './application/sdr-jev.client';
import { SdrRuntimeController } from './sdr-runtime.controller';
import { SdrRuntimeService } from './application/sdr-runtime.service';

@Module({
  imports: [AgentsModule, SuppressionModule],
  controllers: [SdrRuntimeController],
  providers: [SdrRuntimeService, SdrJevClient],
})
export class SdrRuntimeModule {}
