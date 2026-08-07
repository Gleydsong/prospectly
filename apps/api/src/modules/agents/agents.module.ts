import { Module } from '@nestjs/common';

import { CampaignsModule } from '../campaigns/campaigns.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { OllamaChatClient } from './whatsapp-ai/ollama-chat.client';

@Module({
  imports: [PipelinesModule, CampaignsModule],
  controllers: [AgentsController],
  providers: [AgentsService, OllamaChatClient],
  exports: [AgentsService],
})
export class AgentsModule {}
