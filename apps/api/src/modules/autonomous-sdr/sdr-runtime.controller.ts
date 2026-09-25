import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SdrRuntimeService } from './application/sdr-runtime.service';

@ApiTags('sdr')
@ApiBearerAuth()
@Controller({ path: 'sdr/runtime', version: '1' })
export class SdrRuntimeController {
  constructor(private readonly runtime: SdrRuntimeService) {}

  @Get()
  get(@CurrentOrg() organizationId: string) {
    return this.runtime.get(organizationId);
  }

  @Post('run')
  @RequireEmailVerified()
  @Roles('OWNER', 'ADMIN', 'SALES')
  run(@CurrentOrg() organizationId: string) {
    return this.runtime.run(organizationId);
  }
}
