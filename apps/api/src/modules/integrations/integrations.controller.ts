import { Body, Controller, Delete, Get, Headers, Post, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateWebhookIntegrationDto } from './dto/create-webhook-integration.dto';
import { IntegrationsService } from './integrations.service';
import { PluginAccessService } from './plugin-access.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller({ path: 'integrations', version: '1' })
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly plugins: PluginAccessService,
  ) {}

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

  @Get('plugins/tokens')
  @Roles('OWNER', 'ADMIN')
  listPluginTokens(@CurrentOrg() organizationId: string) {
    return this.plugins.listTokens(organizationId);
  }

  @Post('plugins/tokens')
  @Roles('OWNER', 'ADMIN')
  createPluginToken(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { name?: string },
  ) {
    return this.plugins.createToken(organizationId, user.id, body.name ?? 'Prospectly plugin');
  }

  @Delete('plugins/tokens/:id')
  @Roles('OWNER', 'ADMIN')
  async revokePluginToken(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.plugins.revokeToken(organizationId, user.id, id);
    return { revoked: true };
  }

  @Public()
  @Get('plugin/v1/data')
  pluginData(
    @Headers('x-prospectly-plugin-key') key: string | undefined,
    @Query('resource') resource = 'summary',
    @Query('limit') limit?: string,
  ) {
    return this.plugins.resolveOrganization(key).then((organizationId) =>
      this.plugins.extract(organizationId, resource, limit ? Number(limit) : 25),
    );
  }
}
