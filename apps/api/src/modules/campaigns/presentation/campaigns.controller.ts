import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CampaignsService } from '../application/campaigns.service';
import { AddCampaignLeadsDto } from './dto/add-campaign-leads.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateStageTasksDto } from './dto/create-stage-tasks.dto';
import { QueryCampaignsDto } from './dto/query-campaigns.dto';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller({ version: '1' })
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get('campaigns')
  list(@CurrentOrg() organizationId: string, @Query() query: QueryCampaignsDto) {
    return this.campaigns.list(organizationId, query);
  }

  @Get('campaigns/:id')
  get(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.campaigns.get(organizationId, id);
  }

  @Get('campaigns/:id/metrics')
  metrics(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.campaigns.getMetrics(organizationId, id);
  }

  @Post('campaigns')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaigns.create(organizationId, user.id, dto);
  }

  @Post('campaigns/:id/leads')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  addLeads(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCampaignLeadsDto,
  ) {
    return this.campaigns.addLeads(organizationId, id, dto);
  }

  @Post('campaigns/:id/stages/:stageId/tasks')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  createStageTasks(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: CreateStageTasksDto,
  ) {
    return this.campaigns.createStageTasks(organizationId, user.id, id, stageId, dto);
  }
}
