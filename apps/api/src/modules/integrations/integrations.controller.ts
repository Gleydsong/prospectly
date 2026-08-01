import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateWebhookIntegrationDto } from './dto/create-webhook-integration.dto';
import { IntegrationsService } from './integrations.service';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller({ path: 'integrations', version: '1' })
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  list(@CurrentOrg() organizationId: string) {
    return this.integrations.list(organizationId);
  }

  @Post('webhook')
  @Roles('OWNER', 'ADMIN')
  upsertWebhook(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWebhookIntegrationDto,
  ) {
    return this.integrations.upsertWebhook(organizationId, user.id, dto);
  }
}
