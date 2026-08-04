import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { OpsModule } from '../ops/ops.module';
import { ConversionAssetService } from './conversion-asset.service';
import { ConversionStudioController } from './conversion-studio.controller';
import { ConversionStudioPublicController } from './conversion-studio-public.controller';
import { ConversionStudioService } from './conversion-studio.service';
import { DomainBindingService } from './domain-binding.service';
import { EntitlementService } from './entitlement.service';
import { LANDING_GENERATION_QUEUE } from './generation/landing-generation.constants';
import { LandingGenerationService } from './generation/landing-generation.service';
import { GoogleLinkResolver } from './generation/google-link.resolver';
import { GooglePlaceEnrichmentService } from './generation/google-place-enrichment.service';
import { OllamaLandingProvider } from './generation/providers/ollama.provider';
import { TemplateLandingProvider } from './generation/providers/template.provider';

@Module({
  imports: [BullModule.registerQueue({ name: LANDING_GENERATION_QUEUE }), OpsModule],
  controllers: [ConversionStudioController, ConversionStudioPublicController],
  providers: [
    ConversionStudioService,
    EntitlementService,
    ConversionAssetService,
    DomainBindingService,
    TemplateLandingProvider,
    OllamaLandingProvider,
    GoogleLinkResolver,
    GooglePlaceEnrichmentService,
    LandingGenerationService,
  ],
  exports: [
    ConversionStudioService,
    EntitlementService,
    DomainBindingService,
    LandingGenerationService,
  ],
})
export class ConversionStudioModule {}
