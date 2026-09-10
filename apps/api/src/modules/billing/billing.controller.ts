import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BillingService } from './billing.service';
import { BillingProfileService } from './billing-profile.service';
import { AsaasWebhookService } from './asaas-webhook.service';
import { CreateCheckoutDto, CreateCreditCheckoutDto } from './dto/create-checkout.dto';
import { UpdateBillingProfileDto } from './dto/update-billing-profile.dto';

@ApiTags('billing')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly billingProfiles: BillingProfileService,
    private readonly asaasWebhooks: AsaasWebhookService,
  ) {}

  @ApiBearerAuth()
  @Roles('OWNER', 'ADMIN')
  @Get('profile')
  getProfile(@CurrentOrg() organizationId: string) {
    return this.billingProfiles.getProfile(organizationId);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('webhook/asaas')
  handleAsaasWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body missing for Asaas webhook');
    }
    return this.asaasWebhooks.ingest(rawBody, headers);
  }

  @ApiBearerAuth()
  @RequireEmailVerified()
  @Roles('OWNER', 'ADMIN')
  @Put('profile')
  updateProfile(@CurrentOrg() organizationId: string, @Body() dto: UpdateBillingProfileDto) {
    return this.billingProfiles.updateProfile(organizationId, dto);
  }

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
  createCreditCheckout(@CurrentOrg() organizationId: string, @Body() dto: CreateCreditCheckoutDto) {
    return this.billing.createCreditCheckoutSession(organizationId, dto.offer, dto.paymentMethod);
  }

  @ApiBearerAuth()
  @RequireEmailVerified()
  @Roles('OWNER', 'ADMIN')
  @Post('cancel')
  cancelSubscription(@CurrentOrg() organizationId: string) {
    return this.billing.cancelSubscription(organizationId);
  }
}

