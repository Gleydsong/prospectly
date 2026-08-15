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
  @Post('portal')
  createPortal(@CurrentOrg() organizationId: string) {
    return this.billing.createPortalSession(organizationId);
  }

  @ApiBearerAuth()
  @RequireEmailVerified()
  @Roles('OWNER', 'ADMIN')
  @Post('cancel')
  cancelSubscription(@CurrentOrg() organizationId: string) {
    return this.billing.cancelSubscription(organizationId);
  }

  @Public()
  @Post('webhook/stripe')
  handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body missing for Stripe webhook');
    }
    return this.billing.handleStripeWebhook(rawBody, headers);
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

  /** @deprecated Alias → Stripe webhook (one release). Prefer `/billing/webhook/stripe`. */
  @Public()
  @Post('webhook')
  handleWebhookLegacy(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body missing for Stripe webhook');
    }
    return this.billing.handleWebhook(rawBody, signature);
  }
}
