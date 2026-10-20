import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { AssignOwnerDto, ManageTagsDto } from './dto/manage-tags.dto';
import { ExportLeadsDto } from './dto/export-leads.dto';
import { QueryLeadMapDto } from './dto/query-lead-map.dto';
import { LeadMapService } from './lead-map.service';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateLeadWebsiteDto, UpdateLeadWebsiteDto } from './dto/lead-website.dto';
import { LeadWebsitesService } from './lead-websites.service';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@Controller({ path: 'leads', version: '1' })
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly leadWebsites: LeadWebsitesService,
    private readonly leadMap: LeadMapService,
  ) {}

  @Get()
  list(@CurrentOrg() organizationId: string, @Query() query: QueryLeadsDto) {
    return this.leads.list(organizationId, query);
  }

  @Get('map')
  map(@CurrentOrg() organizationId: string, @Query() query: QueryLeadMapDto) {
    return this.leadMap.list(organizationId, query);
  }

  @Get('tags')
  listTags(@CurrentOrg() organizationId: string) {
    return this.leads.listTags(organizationId);
  }

  @Post('export')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  exportCsv(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ExportLeadsDto,
  ) {
    return this.leads.exportCsv(organizationId, user.id, dto);
  }

  @Get(':id')
  getById(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.getById(organizationId, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leads.create(organizationId, dto, user.id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  update(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(organizationId, id, dto);
  }

  @Get(':id/websites')
  listLeadWebsites(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.leadWebsites.list(organizationId, id);
  }

  @Post(':id/websites')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  createLeadWebsite(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLeadWebsiteDto,
  ) {
    return this.leadWebsites.create(organizationId, id, dto);
  }

  @Patch(':id/websites/:websiteId')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  updateLeadWebsite(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body() dto: UpdateLeadWebsiteDto,
  ) {
    return this.leadWebsites.update(organizationId, id, websiteId, dto);
  }

  @Delete(':id/websites/:websiteId')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLeadWebsite(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
  ): Promise<void> {
    await this.leadWebsites.remove(organizationId, id, websiteId);
  }

  @Post(':id/analyze')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  analyzeWebsite(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId?: string,
  ) {
    return this.leads.requestWebsiteAnalysis(organizationId, id, correlationId);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN', 'SALES')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.leads.softDelete(organizationId, id);
  }

  @Post(':id/restore')
  @Roles('OWNER', 'ADMIN', 'SALES')
  restore(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.restore(organizationId, id);
  }

  @Post(':id/owner')
  @Roles('OWNER', 'ADMIN', 'SALES')
  assignOwner(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignOwnerDto,
  ) {
    return this.leads.assignOwner(organizationId, id, dto.ownerId, user.id);
  }

  @Post(':id/tags')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  addTags(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManageTagsDto,
  ) {
    return this.leads.addTags(organizationId, id, dto.tags);
  }

  @Delete(':id/tags/:tagId')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  removeTag(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.leads.removeTag(organizationId, id, tagId);
  }
}
