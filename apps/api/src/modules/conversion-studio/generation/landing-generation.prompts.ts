import { LANDING_PREMIUM_CREATIVE_BRIEF } from './landing-premium-brief';

export const LANDING_SYSTEM_PROMPT = `You generate premium local-business landing pages as structured JSON blocks for Prospectly React Aura.

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "title": string,
  "themeHint": "restaurant|cafe|clinic|barbershop|generic",
  "blocks": [ /* PageBlock[] — max 40 */ ]
}

## Block types (use only these)
hero, rich_text, cta_button, service_card, pricing_cards, testimonials, gallery, faq, contact_form, map_address, footer, spacer

Each block needs: "type", stable fields per type. You may omit "id" — server assigns UUIDs.

## Hard rules
- Portuguese (Brazil) copy unless context says otherwise
- Do NOT invent phone/email/WhatsApp/address/hours/social not in context
- Do NOT invent fake reviews when googleReviews exist — use those texts
- If googleReviews is empty, use generic testimonials sparingly or omit
- Only HTTPS URLs for images; button actions: whatsapp, call, email, external_url, anchor, open_form, calendar
- Use real photos from photos[] in hero + gallery when available
- Follow designReference + premium brief below
- Minimum publishable structure: hero (or rich_text) + at least one CTA (hero.cta, cta_button, or contact_form)

${LANDING_PREMIUM_CREATIVE_BRIEF.replace(/HTML/gi, 'block layout').replace(/html/gi, 'blocks')}`;

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
      task: 'Generate a premium React Aura landing as JSON { title, themeHint?, blocks }',
      creativeGoal:
        'Institutional elegant page unique to this establishment — photos drive identity',
      requirements: [
        'Return blocks[] only — no HTML field',
        'Use Google photos in hero + gallery when photos[] is non-empty',
        'Apply designReference as vertical guidance',
        'Prefer real googleReviews over invented testimonials',
        'Omit sections when data is missing — never fabricate facts',
        'WhatsApp CTA via { type: "whatsapp", phone } when phone exists',
        'Include contact_form with privacyNotice in pt-BR',
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

export function buildRefineUserPrompt(input: {
  companyName: string;
  instruction: string;
  currentBlocks: unknown;
  photos?: Array<{ url: string; alt: string }>;
  designReference?: string | null;
}): string {
  return JSON.stringify(
    {
      task: 'Refine the existing React Aura landing blocks. Return JSON only.',
      outputShape: {
        title: 'optional string',
        ops: 'preferred: array of { op: update|replace|remove|insert, blockId?, patch?, block?, afterBlockId? }',
        blocks: 'optional full blocks[] replacement if ops are impractical',
      },
      rules: [
        'Prefer incremental ops[] over rewriting all blocks',
        'Preserve real photo URLs unless the user asks to change imagery',
        'Do not invent phone/email/hours/social absent from current blocks/context',
        'Do not return HTML — blocks only',
        'Apply the user instruction while keeping publishable structure',
      ],
      businessName: input.companyName,
      instruction: input.instruction,
      photos: input.photos ?? [],
      designReference: input.designReference ?? null,
      currentBlocks: input.currentBlocks,
    },
    null,
    2,
  );
}

/** @deprecated HTML refine removed — use buildRefineUserPrompt */
export function buildRefineHtmlUserPrompt(input: {
  companyName: string;
  instruction: string;
  currentHtml: string;
  photos?: Array<{ url: string; alt: string }>;
  designReference?: string | null;
}): string {
  return buildRefineUserPrompt({
    companyName: input.companyName,
    instruction: input.instruction,
    currentBlocks: [],
    photos: input.photos,
    designReference: input.designReference,
  });
}
