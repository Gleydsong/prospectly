import type { PageBlock } from '../../page-blocks.schema';

export type LandingGenerationPhoto = {
  url: string;
  alt: string;
};

export type LandingGenerationReview = {
  quote: string;
  author: string;
  rating?: number;
};

export type LandingGenerationContext = {
  companyName: string;
  tradeName?: string | null;
  category?: string | null;
  segment?: string | null;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  describeText?: string | null;
  locale?: string;
  externalId?: string | null;
  googlePlaceId?: string | null;
  googleMapsUri?: string | null;
  photos?: LandingGenerationPhoto[];
  googleReviews?: LandingGenerationReview[];
  designReference?: string | null;
  googleEnrichmentStatus?: string | null;
};

export type LandingGenerationResult = {
  title: string;
  blocks: PageBlock[];
  provider: 'ollama' | 'template';
  usedAi: boolean;
};

export interface LandingGenerationProvider {
  readonly name: 'ollama' | 'template';
  generate(context: LandingGenerationContext): Promise<LandingGenerationResult>;
  refine?(
    context: LandingGenerationContext & {
      currentBlocks: PageBlock[];
      currentHtml?: string | null;
      currentTitle: string;
      instruction: string;
    },
  ): Promise<LandingGenerationResult>;
}

export const LANDING_GENERATION_PROVIDER = Symbol('LANDING_GENERATION_PROVIDER');
