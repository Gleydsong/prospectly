import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOpportunityRunDto } from './dto/create-opportunity-run.dto';
import { QueryOpportunityCandidatesDto } from './dto/query-opportunity-candidates.dto';
import { OpportunityFinderService } from './opportunity-finder.service';

@ApiTags('opportunity-finder')
@ApiBearerAuth()
@Controller({ path: 'opportunity-finder', version: '1' })
export class OpportunityFinderController {
  constructor(private readonly service: OpportunityFinderService) {}

  @Post('runs')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOpportunityRunDto, @CorrelationId() correlationId?: string) {
    return this.service.create(organizationId, user.id, dto, correlationId);
  }

  @Get('runs/:id')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  get(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(organizationId, id);
  }

  @Get('runs/:id/candidates')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  candidates(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Query() query: QueryOpportunityCandidatesDto) {
    return this.service.listCandidates(organizationId, id, query);
  }

  @Get('runs/:runId/candidates/:candidateId')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  candidate(@CurrentOrg() organizationId: string, @Param('runId', ParseUUIDPipe) runId: string, @Param('candidateId', ParseUUIDPipe) candidateId: string) {
    return this.service.getCandidate(organizationId, runId, candidateId);
  }

  @Post('runs/:runId/candidates/:candidateId/explanation')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  explain(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser, @Param('runId', ParseUUIDPipe) runId: string, @Param('candidateId', ParseUUIDPipe) candidateId: string) {
    return this.service.explainCandidate(organizationId, user.id, runId, candidateId);
  }

  @Post('runs/:runId/candidates/:candidateId/save-lead')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  save(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser, @Param('runId', ParseUUIDPipe) runId: string, @Param('candidateId', ParseUUIDPipe) candidateId: string) {
    return this.service.saveAsLead(organizationId, user.id, runId, candidateId);
  }
}
