import { Module } from '@nestjs/common';

import { EntitlementService } from '../conversion-studio/entitlement.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, EntitlementService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
