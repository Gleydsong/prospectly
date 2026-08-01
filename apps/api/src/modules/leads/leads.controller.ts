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

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { AssignOwnerDto, ManageTagsDto } from './dto/manage-tags.dto';
import { ExportLeadsDto } from './dto/export-leads.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@Controller({ path: 'leads', version: '1' })
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@CurrentOrg() organizationId: string, @Query() query: QueryLeadsDto) {
    return this.leads.list(organizationId, query);
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

  @Post(':id/analyze')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  analyzeWebsite(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leads.requestWebsiteAnalysis(organizationId, id);
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
