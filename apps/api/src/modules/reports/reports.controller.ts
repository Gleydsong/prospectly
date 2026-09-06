import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { QueryFunnelConversionLeadsDto } from './dto/query-funnel-conversion-leads.dto';
import { QueryFunnelConversionDto } from './dto/query-funnel-conversion.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('funnel-conversion/leads')
  funnelConversionLeads(
    @CurrentOrg() organizationId: string,
    @Query() query: QueryFunnelConversionLeadsDto,
  ) {
    return this.reports.funnelConversionLeads(organizationId, query);
  }

  @Get('funnel-conversion')
  funnelConversion(
    @CurrentOrg() organizationId: string,
    @Query() query: QueryFunnelConversionDto,
  ) {
    return this.reports.funnelConversion(organizationId, query);
  }
}
