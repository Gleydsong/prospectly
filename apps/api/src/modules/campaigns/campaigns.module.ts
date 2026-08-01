import { Module } from '@nestjs/common';

import { CampaignsService } from './application/campaigns.service';
import { TemplatesService } from './application/templates.service';
import { CampaignsController } from './presentation/campaigns.controller';
import { TemplatesController } from './presentation/templates.controller';

@Module({
  controllers: [CampaignsController, TemplatesController],
  providers: [CampaignsService, TemplatesService],
  exports: [CampaignsService, TemplatesService],
})
export class CampaignsModule {}
