import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';

@ApiTags('activities')
@ApiBearerAuth()
@Controller({ version: '1' })
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get('activities/recent')
  listRecent(@CurrentOrg() organizationId: string) {
    return this.activities.listRecent(organizationId);
  }

  @Get('leads/:leadId/activities')
  listForLead(
    @CurrentOrg() organizationId: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.activities.listForLead(organizationId, leadId, page, pageSize);
  }

  @Post('leads/:leadId/activities')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  createForLead(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activities.createForLead(organizationId, leadId, user.id, dto);
  }
}
