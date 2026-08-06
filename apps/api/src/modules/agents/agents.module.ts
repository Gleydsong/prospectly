import { Module } from '@nestjs/common';

import { CampaignsModule } from '../campaigns/campaigns.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [PipelinesModule, CampaignsModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
