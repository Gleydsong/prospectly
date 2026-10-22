import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { SuppressionModule } from '../privacy/suppression.module';
import { AssistantSpikeController } from './assistant-spike.controller';
import { AssistantSpikeGuard } from './assistant-spike.guard';
import { AssistantSpikeService } from './assistant-spike.service';

@Module({
  imports: [AiModule, PrismaModule, SuppressionModule],
  controllers: [AssistantSpikeController],
  providers: [AssistantSpikeService, AssistantSpikeGuard],
  exports: [AssistantSpikeService],
})
export class AssistantSpikeModule {}
