import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../../common/decorators/current-org.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SavedViewsService } from '../application/saved-views.service';
import { CreateSavedViewDto } from './dto/create-saved-view.dto';
import { UpdateSavedViewDto } from './dto/update-saved-view.dto';

@ApiTags('views')
@ApiBearerAuth()
@Controller({ path: 'views', version: '1' })
export class SavedViewsController {
  constructor(private readonly views: SavedViewsService) {}

  @Get()
  list(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.views.list(organizationId, user);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedViewDto,
  ) {
    return this.views.create(organizationId, user, dto);
  }

  @Get(':id/preview')
  preview(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.views.preview(organizationId, user, id);
  }

  @Get(':id')
  getById(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.views.get(organizationId, user, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  update(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedViewDto,
  ) {
    return this.views.update(organizationId, user, id, dto);
  }

  @Post(':id/archive')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  archive(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.views.archive(organizationId, user, id);
  }
}
