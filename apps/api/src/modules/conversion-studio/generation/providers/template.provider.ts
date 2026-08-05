import { Injectable } from '@nestjs/common';

import { defaultBlocksFromLead } from '../../page-blocks.schema';
import type {
  LandingGenerationContext,
  LandingGenerationProvider,
  LandingGenerationResult,
} from './landing-generation.provider';

@Injectable()
export class TemplateLandingProvider implements LandingGenerationProvider {
  readonly name = 'template' as const;

  async generate(context: LandingGenerationContext): Promise<LandingGenerationResult> {
    const blocks = defaultBlocksFromLead({
      companyName: context.companyName,
      category: context.category,
      city: context.city,
      phone: context.phone,
      address: context.address,
      photos: context.photos,
      googleReviews: context.googleReviews,
    });
    return {
      title: context.companyName,
      blocks,
      provider: 'template',
      usedAi: false,
    };
  }

  async refine(
    context: LandingGenerationContext & {
      currentBlocks: import('../../page-blocks.schema').PageBlock[];
      currentHtml?: string | null;
      currentTitle: string;
      instruction: string;
    },
  ): Promise<LandingGenerationResult> {
    void context.instruction;
    return {
      title: context.currentTitle || context.companyName,
      blocks: context.currentBlocks,
      provider: 'template',
      usedAi: false,
    };
  }
}
