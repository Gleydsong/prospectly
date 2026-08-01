import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateScoreRulesDto } from './dto/update-score-rules.dto';
import { ScoringService } from './scoring.service';


@ApiTags('scoring')
@ApiBearerAuth()
@Controller({ path: 'scoring', version: '1' })
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Get('config')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  getConfig(@CurrentOrg() organizationId: string) {
    return this.scoring.getConfig(organizationId);
  }

  @RequireEmailVerified()
  @Patch('config/rules')
  @Roles('OWNER', 'ADMIN')
  updateRules(
    @CurrentOrg() organizationId: string,
    @Body() dto: UpdateScoreRulesDto,
    @CorrelationId() correlationId?: string,
  ) {
    return this.scoring.updateRules(organizationId, dto.rules, correlationId);
  }
}
