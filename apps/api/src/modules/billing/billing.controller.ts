import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@ApiTags('billing')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @ApiBearerAuth()
  @Get('status')
  getStatus(@CurrentOrg() organizationId: string) {
    return this.billing.getOrganizationBilling(organizationId);
  }

  @ApiBearerAuth()
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
    );
  }

  @ApiBearerAuth()
  @Roles('OWNER', 'ADMIN')
  @Post('portal')
  createPortal(@CurrentOrg() organizationId: string) {
    return this.billing.createPortalSession(organizationId);
  }

  @Public()
  @Post('webhook')
  handleWebhook(
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
