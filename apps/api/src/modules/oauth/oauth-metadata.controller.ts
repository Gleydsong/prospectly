import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
  issuerFromMcpResource,
} from './oauth-protocol';
import { OauthService } from './oauth.service';

@ApiTags('oauth-metadata')
@Controller({ path: '.well-known', version: VERSION_NEUTRAL })
export class OauthMetadataController {
  constructor(private readonly oauth: OauthService) {}

  @Public()
  @Get('oauth-protected-resource')
  protectedResource() {
    const resource = this.oauth.mcpResourceUrl();
    const issuer = issuerFromMcpResource(resource);
    return buildProtectedResourceMetadata(resource, issuer);
  }

  @Public()
  @Get('oauth-authorization-server')
  authorizationServer() {
    return buildAuthorizationServerMetadata(issuerFromMcpResource(this.oauth.mcpResourceUrl()));
  }
}
