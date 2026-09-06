import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { QueryFunnelConversionDto } from './dto/query-funnel-conversion.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('funnel-conversion')
  funnelConversion(
    @CurrentOrg() organizationId: string,
    @Query() query: QueryFunnelConversionDto,
  ) {
    return this.reports.funnelConversion(organizationId, query);
  }
}
