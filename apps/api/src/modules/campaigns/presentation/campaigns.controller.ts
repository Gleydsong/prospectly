import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { QueryCampaignLeadsDto } from './dto/query-campaign-leads.dto';
import { QueryCampaignsDto } from './dto/query-campaigns.dto';
import { RecordCampaignLeadResultDto } from './dto/record-campaign-lead-result.dto';
import { UpdateCampaignLeadDto } from './dto/update-campaign-lead.dto';
import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';

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

  @Get('campaigns/:id/leads')
  listLeads(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryCampaignLeadsDto,
  ) {
    return this.campaigns.listLeads(organizationId, id, query);
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

  @Patch('campaigns/:id/status')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  updateStatus(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    return this.campaigns.updateStatus(organizationId, user.id, id, dto);
  }

  @Post('campaigns/:id/leads')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  addLeads(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCampaignLeadsDto,
  ) {
    return this.campaigns.addLeads(organizationId, user.id, id, dto);
  }

  @Delete('campaigns/:id/leads/:leadId')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  removeLead(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ) {
    return this.campaigns.removeLead(organizationId, user.id, id, leadId);
  }

  @Patch('campaigns/:id/leads/:leadId')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  updateLead(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: UpdateCampaignLeadDto,
  ) {
    return this.campaigns.updateLead(organizationId, id, leadId, dto);
  }

  @Post('campaigns/:id/leads/:leadId/result')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  recordResult(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: RecordCampaignLeadResultDto,
  ) {
    return this.campaigns.recordResult(organizationId, user.id, id, leadId, dto);
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
