import { Module } from '@nestjs/common';

import { ConversionAssetService } from './conversion-asset.service';
import { ConversionStudioController } from './conversion-studio.controller';
import { ConversionStudioPublicController } from './conversion-studio-public.controller';
import { ConversionStudioService } from './conversion-studio.service';
import { DomainBindingService } from './domain-binding.service';
import { EntitlementService } from './entitlement.service';

@Module({
  controllers: [ConversionStudioController, ConversionStudioPublicController],
  providers: [
    ConversionStudioService,
    EntitlementService,
    ConversionAssetService,
    DomainBindingService,
  ],
  exports: [ConversionStudioService, EntitlementService, DomainBindingService],
})
export class ConversionStudioModule {}
