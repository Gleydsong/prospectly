import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BillingService } from './billing.service';
import { CreateCheckoutDto, CreateCreditCheckoutDto } from './dto/create-checkout.dto';
import { CreateAppmaxCardCheckoutDto } from './dto/create-appmax-card-checkout.dto';


@ApiTags('billing')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @ApiBearerAuth()
  @Get('status')
  getStatus(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.getOrganizationBilling(organizationId, user.role);
  }

  @ApiBearerAuth()
  @RequireEmailVerified()
  @Roles('OWNER', 'ADMIN')
  @Post('checkout')
  createCheckout(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billing.createCheckoutSession(
      organizationId,
      user.email,
      dto.interval,
      dto.currency,
      dto.paymentMethod,
    );
  }

  @ApiBearerAuth()
  @RequireEmailVerified()
  @Roles('OWNER', 'ADMIN')
  @Post('credits/checkout')
  createCreditCheckout(
    @CurrentOrg() organizationId: string,
    @Body() dto: CreateCreditCheckoutDto,
  ) {
    return this.billing.createCreditCheckoutSession(
      organizationId,
      dto.offer,
      dto.paymentMethod,
    );
  }

  @ApiBearerAuth()
  @RequireEmailVerified()
  @Roles('OWNER', 'ADMIN')
  @Post('card/checkout')
  createCardCheckout(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppmaxCardCheckoutDto,
  ) {
    return this.billing.createAppmaxCardCheckout(organizationId, user.email, dto);
  }

  @ApiBearerAuth()
  @Get('card/config')
  getCardConfig() {
    return this.billing.getAppmaxBrowserConfig();
  }

  @Public()
  @Get('appmax/health')
  getAppmaxHealth() {
    return this.billing.getAppmaxHealthCheck();
  }

  @Public()
  @Post('appmax/health')
  postAppmaxHealth() {
    return this.billing.getAppmaxHealthCheck();
  }

  @ApiBearerAuth()
  @RequireEmailVerified()
  @Roles('OWNER', 'ADMIN')
  @Post('cancel')
  cancelSubscription(@CurrentOrg() organizationId: string) {
    return this.billing.cancelSubscription(organizationId);
  }

  @Public()
  @Post('webhook/abacate')
  handleAbacateWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body missing for Abacate webhook');
    }
    return this.billing.handleAbacateWebhook(rawBody, headers, query);
  }

  @Public()
  @Post('webhook/appmax')
  handleAppmaxWebhook(
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body missing for Appmax webhook');
    }
    return this.billing.handleAppmaxWebhook(rawBody);
  }
}
