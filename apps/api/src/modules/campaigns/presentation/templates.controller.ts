import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { CurrentOrg } from '../../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TemplatesService } from '../application/templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@ApiTags('message-templates')
@ApiBearerAuth()
@Controller({ version: '1' })
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get('message-templates/variables')
  listVariables() {
    return { variables: this.templates.listAllowedVariables() };
  }

  @Get('message-templates')
  list(@CurrentOrg() organizationId: string, @Query() query: PaginationQueryDto) {
    return this.templates.list(organizationId, query);
  }

  @Get('message-templates/:id')
  get(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.get(organizationId, id);
  }

  @Post('message-templates')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templates.create(organizationId, user.id, dto);
  }

  @Patch('message-templates/:id')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  update(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templates.update(organizationId, user.id, id, dto);
  }

  @Post('message-templates/preview')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER', 'VIEWER')
  preview(@Body() dto: PreviewTemplateDto) {
    return this.templates.preview(dto);
  }
}
