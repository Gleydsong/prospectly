import { Module } from '@nestjs/common';

import { ConversionStudioController } from './conversion-studio.controller';
import { ConversionStudioPublicController } from './conversion-studio-public.controller';
import { ConversionStudioService } from './conversion-studio.service';
import { EntitlementService } from './entitlement.service';

@Module({
  controllers: [ConversionStudioController, ConversionStudioPublicController],
  providers: [ConversionStudioService, EntitlementService],
  exports: [ConversionStudioService, EntitlementService],
})
export class ConversionStudioModule {}
