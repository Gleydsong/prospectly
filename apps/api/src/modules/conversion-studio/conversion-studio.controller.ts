import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConversionStudioService } from './conversion-studio.service';
import {
  CreateConversionPageDto,
  QueryConversionPagesDto,
  RestoreVersionDto,
  UpdateConversionPageDraftDto,
} from './dto/conversion-page.dto';
import { EntitlementService } from './entitlement.service';

@ApiTags('conversion-studio')
@ApiBearerAuth()
@Controller({ path: 'conversion-pages', version: '1' })
export class ConversionStudioController {
  constructor(
    private readonly studio: ConversionStudioService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get('entitlements')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER', 'VIEWER')
  entitlementsSnapshot(@CurrentOrg() organizationId: string) {
    return this.entitlements.getSnapshot(organizationId);
  }

  @Get()
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER', 'VIEWER')
  list(@CurrentOrg() organizationId: string, @Query() query: QueryConversionPagesDto) {
    return this.studio.list(organizationId, query);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversionPageDto,
  ) {
    return this.studio.create(organizationId, user.id, dto);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER', 'VIEWER')
  get(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.studio.get(organizationId, id);
  }

  @Patch(':id/draft')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  updateDraft(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversionPageDraftDto,
  ) {
    return this.studio.updateDraft(organizationId, id, user.id, dto);
  }

  @Post(':id/publish')
  @Roles('OWNER', 'ADMIN', 'SALES')
  publish(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.studio.publish(organizationId, id, user.id);
  }

  @Post(':id/unpublish')
  @Roles('OWNER', 'ADMIN', 'SALES')
  unpublish(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.studio.unpublish(organizationId, id, user.id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN')
  archive(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.studio.archive(organizationId, id, user.id);
  }

  @Post(':id/restore-version')
  @Roles('OWNER', 'ADMIN', 'SALES')
  restoreVersion(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestoreVersionDto,
  ) {
    return this.studio.restoreVersion(organizationId, id, dto.version, user.id);
  }

  @Get(':id/metrics')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER', 'VIEWER')
  metrics(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days?: string,
  ) {
    const parsed = days ? Number(days) : 30;
    return this.studio.metrics(organizationId, id, Number.isFinite(parsed) ? parsed : 30);
  }
}
