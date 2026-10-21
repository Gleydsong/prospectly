import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { SuppressionModule } from '../privacy/suppression.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { WhatsappAiService } from './whatsapp-ai/whatsapp-ai.service';

@Module({
  imports: [PipelinesModule, CampaignsModule, AiModule, SuppressionModule],
  controllers: [AgentsController],
  providers: [AgentsService, WhatsappAiService],
  exports: [AgentsService, WhatsappAiService],
})
export class AgentsModule {}
