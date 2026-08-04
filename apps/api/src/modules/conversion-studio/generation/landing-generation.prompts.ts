import { LANDING_PREMIUM_CREATIVE_BRIEF } from './landing-premium-brief';

export const LANDING_SYSTEM_PROMPT = `You generate premium local-business landing pages as self-contained HTML for Prospectly.

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "title": string,
  "html": string
}

Where "html" is a complete HTML document (DOCTYPE + html + head with style + body).

## Hard rules
- Portuguese (Brazil) copy unless context says otherwise
- Do NOT invent phone/email/WhatsApp/address/hours/social not in context
- Do NOT invent fake reviews when googleReviews exist — use those texts
- If googleReviews is empty, omit testimonials
- Only HTTPS URLs for images; only https/mailto/tel/wa.me for links
- NO scripts, iframes, event handlers, or javascript: URLs
- Use real photos from photos[] in hero + gallery when available
- Follow designReference + the premium brief below

${LANDING_PREMIUM_CREATIVE_BRIEF}`;

export function buildUserPrompt(context: {
  companyName: string;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  description?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  describeText?: string | null;
  photos?: Array<{ url: string; alt: string }>;
  googleReviews?: Array<{ quote: string; author: string; rating?: number }>;
  designReference?: string | null;
  googleMapsUri?: string | null;
  googleEnrichmentStatus?: string | null;
}): string {
  return JSON.stringify(
    {
      task: 'Generate a premium photo-first HTML landing page as JSON { title, html }',
      creativeGoal:
        'Institutional elegant page unique to this establishment — photos drive identity',
      requirements: [
        'Complete self-contained HTML document in html field',
        'Use Google photos in hero + gallery when photos[] is non-empty',
        'Apply designReference as vertical guidance',
        'Prefer real googleReviews over invented testimonials',
        'Omit sections when data is missing — never fabricate facts',
        'WhatsApp CTA via https://wa.me/ when phone exists (digits only in path)',
      ],
      business: {
        name: context.companyName,
        category: context.category,
        city: context.city,
        state: context.state,
        address: context.address,
        phone: context.phone,
        email: context.email,
        website: context.website,
        description: context.description,
        rating: context.rating,
        reviewCount: context.reviewCount,
        googleMapsUri: context.googleMapsUri ?? null,
      },
      photos: context.photos ?? [],
      googleReviews: context.googleReviews ?? [],
      designReference: context.designReference ?? null,
      googleEnrichmentStatus: context.googleEnrichmentStatus ?? null,
      freeformBrief: context.describeText ?? null,
    },
    null,
    2,
  );
}

export function buildRefineHtmlUserPrompt(input: {
  companyName: string;
  instruction: string;
  currentHtml: string;
  photos?: Array<{ url: string; alt: string }>;
  designReference?: string | null;
}): string {
  return JSON.stringify(
    {
      task: 'Refine the existing HTML landing. Return full JSON { title?, html } with a complete updated HTML document.',
      rules: [
        'Preserve real photo URLs unless the user asks to change imagery',
        'Do not invent phone/email/hours/social absent from current HTML/context',
        'Keep self-contained HTML (style in head), no scripts',
        'Raise editorial/visual quality while applying the instruction',
        'Return JSON only',
      ],
      businessName: input.companyName,
      instruction: input.instruction,
      photos: input.photos ?? [],
      designReference: input.designReference ?? null,
      currentHtml: input.currentHtml,
    },
    null,
    2,
  );
}

/** @deprecated block refine — kept for type compatibility in older tests if any */
export function buildRefineUserPrompt(input: {
  companyName: string;
  instruction: string;
  currentBlocks: unknown;
  photos?: Array<{ url: string; alt: string }>;
  designReference?: string | null;
}): string {
  return buildRefineHtmlUserPrompt({
    companyName: input.companyName,
    instruction: input.instruction,
    currentHtml: JSON.stringify(input.currentBlocks),
    photos: input.photos,
    designReference: input.designReference,
  });
}
