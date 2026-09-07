import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CustomFieldsService } from './custom-fields.service';
import {
  CreateCustomFieldDto,
  ReorderCustomFieldsDto,
  UpdateCustomFieldDto,
} from './dto/custom-field.dto';

@ApiTags('custom-fields')
@ApiBearerAuth()
@Controller({ path: 'custom-fields', version: '1' })
export class CustomFieldsController {
  constructor(private readonly customFields: CustomFieldsService) {}

  @Get()
  list(@CurrentOrg() organizationId: string) {
    return this.customFields.list(organizationId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@CurrentOrg() organizationId: string, @Body() dto: CreateCustomFieldDto) {
    return this.customFields.create(organizationId, dto);
  }

  @Post('reorder')
  @Roles('OWNER', 'ADMIN')
  reorder(@CurrentOrg() organizationId: string, @Body() dto: ReorderCustomFieldsDto) {
    return this.customFields.reorder(organizationId, dto.ids);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFields.update(organizationId, id, dto);
  }

  @Post(':id/archive')
  @Roles('OWNER', 'ADMIN')
  archive(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.customFields.archive(organizationId, id);
  }

  @Post(':id/unarchive')
  @Roles('OWNER', 'ADMIN')
  unarchive(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.customFields.unarchive(organizationId, id);
  }
}
