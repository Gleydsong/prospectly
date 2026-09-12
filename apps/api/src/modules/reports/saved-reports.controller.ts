import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateSavedReportDto } from './dto/create-saved-report.dto';
import { QuerySavedReportLeadsDto } from './dto/query-saved-report-leads.dto';
import { SavedReportsService } from './saved-reports.service';

@ApiTags('saved-reports')
@ApiBearerAuth()
@Controller({ path: 'saved-reports', version: '1' })
export class SavedReportsController {
  constructor(private readonly savedReports: SavedReportsService) {}

  @Get()
  list(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.savedReports.list(organizationId, user);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedReportDto,
  ) {
    return this.savedReports.create(organizationId, user, dto);
  }

  @Get(':id/funnel-conversion/leads')
  funnelConversionLeads(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QuerySavedReportLeadsDto,
  ) {
    return this.savedReports.funnelConversionLeads(organizationId, user, id, query);
  }

  @Get(':id/funnel-conversion')
  funnelConversion(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.savedReports.funnelConversion(organizationId, user, id);
  }

  @Get(':id')
  getById(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.savedReports.get(organizationId, user, id);
  }

  @Post(':id/archive')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  archive(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.savedReports.archive(organizationId, user, id);
  }
}
