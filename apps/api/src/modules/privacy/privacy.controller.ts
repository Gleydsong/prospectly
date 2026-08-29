import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { AccountErasureService } from './account-erasure.service';
import { AccountExportService } from './account-export.service';
import { CONSENT_TYPES, ConsentService, type ConsentType } from './consent.service';
import { CreatePrivacyRequestDto } from './dto/create-privacy-request.dto';
import { PrivacyConsentDto } from './dto/privacy-consent.dto';
import { PrivacyCorrectionDto } from './dto/privacy-correction.dto';
import { PrivacyService } from './privacy.service';

@ApiTags('privacy')
@ApiBearerAuth()
@Controller({ path: 'privacy', version: '1' })
export class PrivacyController {
  constructor(
    private readonly privacy: PrivacyService,
    private readonly exports: AccountExportService,
    private readonly erasure: AccountErasureService,
    private readonly consents: ConsentService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.privacy.getSnapshot(user.id);
  }

  @RequireEmailVerified()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Get('export')
  @Header('Content-Type', 'application/json; charset=utf-8')
  async export(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    const payload = await this.exports.exportAccount(user.id, user.organizationId);
    res.setHeader('Content-Disposition', 'attachment; filename="prospectly-data-export.json"');
    return payload;
  }

  @RequireEmailVerified()
  @Post('requests')
  createRequest(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePrivacyRequestDto) {
    return this.privacy.createRequest(user.id, user.organizationId, dto.type, dto.notes);
  }

  @RequireEmailVerified()
  @Post('correction')
  correction(@CurrentUser() user: AuthenticatedUser, @Body() dto: PrivacyCorrectionDto) {
    return this.privacy.correctName(user.id, dto.name, user.organizationId);
  }

  @Get('consent')
  listConsent(@CurrentUser() user: AuthenticatedUser) {
    return this.consents.list(user.id);
  }

  @Post('consent')
  grantConsent(@CurrentUser() user: AuthenticatedUser, @Body() dto: PrivacyConsentDto) {
    return this.consents.grant(user.id, dto.type, 'privacy_api', user.organizationId);
  }

  @HttpCode(HttpStatus.OK)
  @Delete('consent/:type')
  withdrawConsent(@CurrentUser() user: AuthenticatedUser, @Param('type') type: string) {
    const allowed = Object.values(CONSENT_TYPES) as ConsentType[];
    if (!allowed.includes(type as ConsentType)) {
      throw new BadRequestException('Unknown consent type');
    }
    return this.consents.withdraw(user.id, type as ConsentType, user.organizationId);
  }

  @RequireEmailVerified()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @Delete('account')
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    await this.erasure.eraseAccount(user.id, user.organizationId);
    return { status: 'ANONYMIZED' };
  }
}
