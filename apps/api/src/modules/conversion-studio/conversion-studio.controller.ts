import {
  Body,
  Controller,
  Delete,
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
import { ConversionAssetService } from './conversion-asset.service';
import { ConversionStudioService } from './conversion-studio.service';
import { DomainBindingService } from './domain-binding.service';
import {
  CreateConversionPageDto,
  CreateDomainBindingDto,
  GenerateLandingDto,
  QueryConversionPagesDto,
  RefineLandingDto,
  RegisterPageAssetDto,
  RestoreVersionDto,
  UpdateAnalyticsSettingsDto,
  UpdateConversionPageDraftDto,
} from './dto/conversion-page.dto';
import { EntitlementService } from './entitlement.service';
import { LandingGenerationService } from './generation/landing-generation.service';

@ApiTags('conversion-studio')
@ApiBearerAuth()
@Controller({ path: 'conversion-pages', version: '1' })
export class ConversionStudioController {
  constructor(
    private readonly studio: ConversionStudioService,
    private readonly entitlements: EntitlementService,
    private readonly assets: ConversionAssetService,
    private readonly domains: DomainBindingService,
    private readonly generation: LandingGenerationService,
  ) {}

  @Get('entitlements')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER', 'VIEWER')
  entitlementsSnapshot(@CurrentOrg() organizationId: string) {
    return this.entitlements.getSnapshot(organizationId);
  }

  @Get('domains')
  @Roles('OWNER', 'ADMIN')
  listDomains(@CurrentOrg() organizationId: string) {
    return this.domains.list(organizationId);
  }

  @Post('domains')
  @Roles('OWNER', 'ADMIN')
  createDomain(@CurrentOrg() organizationId: string, @Body() dto: CreateDomainBindingDto) {
    return this.domains.create(organizationId, dto.hostname, dto.pageId);
  }

  @Post('domains/:id/verify')
  @Roles('OWNER', 'ADMIN')
  verifyDomain(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.domains.verify(organizationId, id);
  }

  @Delete('domains/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async removeDomain(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.domains.remove(organizationId, id);
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

  @Post('generate')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  generate(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateLandingDto,
  ) {
    return this.generation.enqueueGenerate(organizationId, user.id, dto);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER', 'VIEWER')
  get(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.studio.get(organizationId, id);
  }

  @Post(':id/refine')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  refine(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefineLandingDto,
  ) {
    return this.generation.enqueueRefine(organizationId, id, user.id, dto.instruction);
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

  @Patch(':id/analytics')
  @Roles('OWNER', 'ADMIN', 'SALES')
  updateAnalytics(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnalyticsSettingsDto,
  ) {
    return this.studio.updateAnalyticsSettings(organizationId, id, user.id, dto);
  }

  @Get(':id/assets')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER', 'VIEWER')
  listAssets(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.list(organizationId, id);
  }

  @Post(':id/assets')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  registerAsset(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterPageAssetDto,
  ) {
    return this.assets.register(organizationId, id, dto);
  }

  @Delete(':id/assets/:assetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN', 'SALES')
  async removeAsset(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ) {
    await this.assets.remove(organizationId, id, assetId);
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
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
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
