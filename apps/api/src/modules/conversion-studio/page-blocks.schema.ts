import { z } from 'zod';

const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), { message: 'Only HTTPS URLs are allowed' })
  .refine((value) => !/^javascript:/i.test(value), { message: 'Unsafe URL scheme' });

const phoneSchema = z
  .string()
  .min(5)
  .max(32)
  .regex(/^\+?[0-9()\-\s]+$/, { message: 'Invalid phone' });

const emailSchema = z.string().email().max(254);

const anchorSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z][\w-]*$/, { message: 'Invalid anchor' });

export const buttonActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('whatsapp'), phone: phoneSchema, message: z.string().max(500).optional() }),
  z.object({ type: z.literal('call'), phone: phoneSchema }),
  z.object({ type: z.literal('email'), email: emailSchema, subject: z.string().max(200).optional() }),
  z.object({
    type: z.literal('external_url'),
    url: httpsUrl,
    utmSource: z.string().max(64).optional(),
    utmMedium: z.string().max(64).optional(),
    utmCampaign: z.string().max(64).optional(),
  }),
  z.object({ type: z.literal('anchor'), anchor: anchorSchema }),
  z.object({ type: z.literal('open_form'), formBlockId: z.string().uuid() }),
  z.object({ type: z.literal('calendar'), url: httpsUrl }),
]);

export type ButtonAction = z.infer<typeof buttonActionSchema>;

const colorToken = z.enum(['brand', 'zinc', 'emerald', 'amber', 'white']);
const layoutToken = z.enum(['stack', 'split', 'grid-2', 'grid-3']);
const visibilitySchema = z
  .object({
    mobile: z.boolean().default(true),
    desktop: z.boolean().default(true),
  })
  .default({ mobile: true, desktop: true });

const baseBlock = z.object({
  id: z.string().uuid(),
  visibility: visibilitySchema.optional(),
});

export const pageBlockSchema = z.discriminatedUnion('type', [
  baseBlock.extend({
    type: z.literal('hero'),
    headline: z.string().min(1).max(120),
    subheadline: z.string().max(240).optional(),
    cta: buttonActionSchema.optional(),
    ctaLabel: z.string().max(60).optional(),
    imageUrl: httpsUrl.optional(),
    imageAlt: z.string().max(160).optional(),
    variant: colorToken.default('brand'),
  }),
  baseBlock.extend({
    type: z.literal('rich_text'),
    title: z.string().max(120).optional(),
    body: z.string().max(4000),
    bullets: z.array(z.string().max(200)).max(20).optional(),
  }),
  baseBlock.extend({
    type: z.literal('cta_button'),
    label: z.string().min(1).max(60),
    action: buttonActionSchema,
    variant: colorToken.default('brand'),
  }),
  baseBlock.extend({
    type: z.literal('service_card'),
    title: z.string().min(1).max(120),
    description: z.string().max(600),
    icon: z.string().max(40).optional(),
    imageUrl: httpsUrl.optional(),
    imageAlt: z.string().max(160).optional(),
    cta: buttonActionSchema.optional(),
    ctaLabel: z.string().max(60).optional(),
    highlight: z.boolean().default(false),
    layout: layoutToken.default('stack'),
  }),
  baseBlock.extend({
    type: z.literal('pricing_cards'),
    title: z.string().max(120).optional(),
    cards: z
      .array(
        z.object({
          name: z.string().min(1).max(80),
          price: z.string().min(1).max(40),
          description: z.string().max(400).optional(),
          features: z.array(z.string().max(120)).max(12).default([]),
          highlighted: z.boolean().default(false),
          cta: buttonActionSchema.optional(),
          ctaLabel: z.string().max(60).optional(),
        }),
      )
      .min(1)
      .max(4),
  }),
  baseBlock.extend({
    type: z.literal('testimonials'),
    title: z.string().max(120).optional(),
    items: z
      .array(
        z.object({
          quote: z.string().min(1).max(600),
          author: z.string().min(1).max(80),
          role: z.string().max(80).optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
  baseBlock.extend({
    type: z.literal('gallery'),
    title: z.string().max(120).optional(),
    images: z
      .array(
        z.object({
          url: httpsUrl,
          alt: z.string().min(1).max(160),
        }),
      )
      .min(1)
      .max(12),
  }),
  baseBlock.extend({
    type: z.literal('faq'),
    title: z.string().max(120).optional(),
    items: z
      .array(
        z.object({
          question: z.string().min(1).max(200),
          answer: z.string().min(1).max(1000),
        }),
      )
      .min(1)
      .max(20),
  }),
  baseBlock.extend({
    type: z.literal('contact_form'),
    title: z.string().max(120).optional(),
    submitLabel: z.string().min(1).max(60).default('Enviar'),
    privacyNotice: z.string().min(1).max(500),
    fields: z
      .array(z.enum(['name', 'email', 'phone', 'message']))
      .min(1)
      .max(4)
      .default(['name', 'email', 'message']),
  }),
  baseBlock.extend({
    type: z.literal('map_address'),
    title: z.string().max(120).optional(),
    address: z.string().min(1).max(240),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  baseBlock.extend({
    type: z.literal('footer'),
    text: z.string().max(240).optional(),
    showProspectlyBrand: z.boolean().default(true),
  }),
  baseBlock.extend({
    type: z.literal('spacer'),
    size: z.enum(['sm', 'md', 'lg']).default('md'),
  }),
]);

export type PageBlock = z.infer<typeof pageBlockSchema>;

export const pageBlocksSchema = z.array(pageBlockSchema).max(40);

export function parsePageBlocks(input: unknown): PageBlock[] {
  return pageBlocksSchema.parse(input);
}

export function assertPublishableBlocks(blocks: PageBlock[]): void {
  if (blocks.length === 0) {
    throw new Error('Page must contain at least one block');
  }
  const hasHeroOrText = blocks.some((block) => block.type === 'hero' || block.type === 'rich_text');
  if (!hasHeroOrText) {
    throw new Error('Page must include a hero or text block before publishing');
  }
  const hasCta = blocks.some(
    (block) =>
      block.type === 'cta_button' ||
      block.type === 'contact_form' ||
      (block.type === 'hero' && block.cta) ||
      (block.type === 'service_card' && block.cta),
  );
  if (!hasCta) {
    throw new Error('Page must include at least one CTA or contact form before publishing');
  }
}

export function defaultBlocksFromLead(input: {
  companyName: string;
  category?: string | null;
  city?: string | null;
  phone?: string | null;
  address?: string | null;
}): PageBlock[] {
  const heroId = crypto.randomUUID();
  const servicesId = crypto.randomUUID();
  const formId = crypto.randomUUID();
  const footerId = crypto.randomUUID();
  const ctaAction: ButtonAction | undefined = input.phone
    ? { type: 'whatsapp', phone: input.phone }
    : { type: 'open_form', formBlockId: formId };

  return [
    {
      id: heroId,
      type: 'hero',
      headline: `Proposta para ${input.companyName}`,
      subheadline: [input.category, input.city].filter(Boolean).join(' · ') || undefined,
      cta: ctaAction,
      ctaLabel: input.phone ? 'Falar no WhatsApp' : 'Pedir proposta',
      variant: 'brand',
    },
    {
      id: servicesId,
      type: 'service_card',
      title: 'Site profissional para o seu negócio',
      description:
        'Página rápida, mobile-first e pronta para converter visitas em contactos comerciais.',
      highlight: true,
      layout: 'stack',
    },
    {
      id: formId,
      type: 'contact_form',
      title: 'Quer conversar?',
      submitLabel: 'Enviar',
      privacyNotice: 'Ao enviar, você concorda com o tratamento dos dados para contacto comercial.',
      fields: ['name', 'email', 'phone', 'message'],
    },
    ...(input.address
      ? [
          {
            id: crypto.randomUUID(),
            type: 'map_address' as const,
            title: 'Localização',
            address: input.address,
          },
        ]
      : []),
    {
      id: footerId,
      type: 'footer',
      text: `© ${new Date().getFullYear()} ${input.companyName}`,
      showProspectlyBrand: true,
    },
  ];
}
