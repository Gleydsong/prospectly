import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query, Redirect } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ConsentDto } from './dto/consent.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { RevokeDto } from './dto/revoke.dto';
import { TokenDto } from './dto/token.dto';
import { OauthService, type AuthorizeQuery } from './oauth.service';

@ApiTags('oauth')
@ApiBearerAuth()
@Controller({ path: 'oauth', version: '1' })
export class OauthController {
  constructor(private readonly oauth: OauthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: RegisterClientDto) {
    return this.oauth.registerClient(body);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('authorize')
  @Redirect()
  async authorize(@Query() query: AuthorizeQuery) {
    const url = await this.oauth.buildConsentRedirectUrl(query);
    return { url, statusCode: 302 };
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('consent')
  async consent(@CurrentUser() user: AuthenticatedUser, @Body() body: ConsentDto) {
    return this.oauth.consent(user.id, body);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(@Body() body: TokenDto) {
    return this.oauth.exchangeToken(body);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(@Body() body: RevokeDto) {
    await this.oauth.revokeToken(body.token);
    return {};
  }
}
