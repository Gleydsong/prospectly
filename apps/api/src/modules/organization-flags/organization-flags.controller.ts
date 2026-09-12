import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  OrganizationFlagKeyParamDto,
  UpdateOrganizationFlagDto,
} from './dto/update-organization-flag.dto';
import { OrganizationFlagsService } from './organization-flags.service';

@ApiTags('organization-flags')
@ApiBearerAuth()
@Controller({ path: 'organization-flags', version: '1' })
export class OrganizationFlagsController {
  constructor(private readonly flags: OrganizationFlagsService) {}

  @Get()
  list(@CurrentOrg() organizationId: string) {
    return this.flags.list(organizationId);
  }

  @RequireEmailVerified()
  @Put(':key')
  @Roles('OWNER', 'ADMIN')
  update(
    @CurrentOrg() organizationId: string,
    @Param() params: OrganizationFlagKeyParamDto,
    @Body() dto: UpdateOrganizationFlagDto,
  ) {
    return this.flags.set(organizationId, params.key, dto.enabled);
  }
}
