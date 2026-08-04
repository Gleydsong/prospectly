import { z } from 'zod';

const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), { message: 'Only HTTPS URLs are allowed' });

const phoneSchema = z
  .string()
  .min(5)
  .max(32)
  .regex(/^\+?[0-9()\-\s]+$/);

const emailSchema = z.string().email().max(254);

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
  z.object({
    type: z.literal('anchor'),
    anchor: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z][\w-]*$/),
  }),
  z.object({ type: z.literal('open_form'), formBlockId: z.string().uuid() }),
  z.object({ type: z.literal('calendar'), url: httpsUrl }),
]);

export type ButtonAction = z.infer<typeof buttonActionSchema>;

const colorToken = z.enum(['brand', 'zinc', 'emerald', 'amber', 'white']);
const baseBlock = z.object({ id: z.string().uuid() });

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
    highlight: z.boolean().default(false),
    layout: z.enum(['stack', 'split', 'grid-2', 'grid-3']).default('stack'),
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
      .array(z.object({ url: httpsUrl, alt: z.string().min(1).max(160) }))
      .min(1)
      .max(12),
  }),
  baseBlock.extend({
    type: z.literal('faq'),
    title: z.string().max(120).optional(),
    items: z
      .array(z.object({ question: z.string().min(1).max(200), answer: z.string().min(1).max(1000) }))
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
export type PageBlockType = PageBlock['type'];

export const pageBlocksSchema = z.array(pageBlockSchema).max(40);

export const BLOCK_LIBRARY: Array<{ type: PageBlockType; label: string }> = [
  { type: 'hero', label: 'Hero' },
  { type: 'rich_text', label: 'Texto' },
  { type: 'cta_button', label: 'Botão CTA' },
  { type: 'service_card', label: 'Serviço' },
  { type: 'pricing_cards', label: 'Preços' },
  { type: 'testimonials', label: 'Depoimentos' },
  { type: 'gallery', label: 'Galeria' },
  { type: 'faq', label: 'FAQ' },
  { type: 'contact_form', label: 'Formulário' },
  { type: 'map_address', label: 'Mapa/endereço' },
  { type: 'footer', label: 'Rodapé' },
  { type: 'spacer', label: 'Espaçador' },
];

export function createBlock(type: PageBlockType): PageBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case 'hero':
      return { id, type, headline: 'Nova proposta', variant: 'brand', ctaLabel: 'Falar agora' };
    case 'rich_text':
      return { id, type, body: 'Descreva o valor da oferta.' };
    case 'cta_button':
      return {
        id,
        type,
        label: 'Contactar',
        action: { type: 'external_url', url: 'https://example.com' },
        variant: 'brand',
      };
    case 'service_card':
      return {
        id,
        type,
        title: 'Serviço',
        description: 'Descrição do serviço.',
        highlight: false,
        layout: 'stack',
      };
    case 'pricing_cards':
      return {
        id,
        type,
        title: 'Planos',
        cards: [{ name: 'Essencial', price: '€X', features: ['Item 1'], highlighted: false }],
      };
    case 'testimonials':
      return {
        id,
        type,
        title: 'Depoimentos',
        items: [{ quote: 'Excelente trabalho.', author: 'Cliente' }],
      };
    case 'gallery':
      return {
        id,
        type,
        images: [{ url: 'https://placehold.co/600x400', alt: 'Exemplo' }],
      };
    case 'faq':
      return {
        id,
        type,
        title: 'FAQ',
        items: [{ question: 'Como funciona?', answer: 'Explicação breve.' }],
      };
    case 'contact_form':
      return {
        id,
        type,
        title: 'Contacto',
        submitLabel: 'Enviar',
        privacyNotice: 'Ao enviar, você concorda com o contacto comercial.',
        fields: ['name', 'email', 'message'],
      };
    case 'map_address':
      return { id, type, address: 'Rua Exemplo, 100' };
    case 'footer':
      return { id, type, text: '© Prospectly', showProspectlyBrand: true };
    case 'spacer':
      return { id, type, size: 'md' };
  }
}
