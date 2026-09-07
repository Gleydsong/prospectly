import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { GoogleConnectionsService } from './google-connections.service';

@ApiTags('google-connections')
@ApiBearerAuth()
@Controller({ path: 'google-connections', version: '1' })
export class GoogleConnectionsController {
  constructor(
    private readonly connections: GoogleConnectionsService,
    private readonly config: ConfigService,
  ) {}

  @Get('me')
  me(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.connections.getMine(organizationId, user.id);
  }

  @Get()
  @Roles('ADMIN')
  listOrg(@CurrentOrg() organizationId: string) {
    return this.connections.listOrg(organizationId);
  }

  @Get('start')
  @Roles('MEMBER')
  @RequireEmailVerified()
  start(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser) {
    return { url: this.connections.buildAuthorizationUrl(user.id, organizationId) };
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const frontend = (this.config.get<string>('frontendUrl') ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    );
    const fail = (reason: string) => res.redirect(`${frontend}/settings?tab=account&google=${reason}`);
    if (error || !code || !state) {
      return fail('denied');
    }
    try {
      await this.connections.completeFromCallback(code, state);
      return res.redirect(`${frontend}/settings?tab=account&google=connected`);
    } catch {
      return fail('error');
    }
  }

  @Post('disconnect')
  @Roles('MEMBER')
  @RequireEmailVerified()
  disconnect(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.connections.disconnect(organizationId, user.id);
  }

  @Post(':userId/revoke')
  @Roles('ADMIN')
  @RequireEmailVerified()
  revoke(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.connections.revoke(organizationId, user.id, userId);
  }
}
