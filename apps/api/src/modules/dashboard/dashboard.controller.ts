import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentOrg() organizationId: string) {
    return this.dashboard.summary(organizationId);
  }

  @Get('charts')
  charts(@CurrentOrg() organizationId: string) {
    return this.dashboard.charts(organizationId);
  }
}
