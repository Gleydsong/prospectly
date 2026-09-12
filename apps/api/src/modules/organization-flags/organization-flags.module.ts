import { Module } from '@nestjs/common';

import { OrganizationFlagsController } from './organization-flags.controller';
import { OrganizationFlagsService } from './organization-flags.service';

@Module({
  controllers: [OrganizationFlagsController],
  providers: [OrganizationFlagsService],
  exports: [OrganizationFlagsService],
})
export class OrganizationFlagsModule {}
