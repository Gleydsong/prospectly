import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CommunicationsService } from './communications.service';

@ApiTags('communications')
@ApiBearerAuth()
@Controller({ version: '1' })
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get('leads/:leadId/synced-communications')
  listForLead(
    @CurrentOrg() organizationId: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.communications.listForLead(organizationId, leadId, page, pageSize);
  }
}
