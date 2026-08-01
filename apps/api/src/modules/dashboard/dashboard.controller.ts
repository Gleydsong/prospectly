import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentOrg() organizationId: string, @Query() query: QueryDashboardDto) {
    return this.dashboard.summary(organizationId, query);
  }

  @Get('charts')
  charts(@CurrentOrg() organizationId: string, @Query() query: QueryDashboardDto) {
    return this.dashboard.charts(organizationId, query);
  }
}
