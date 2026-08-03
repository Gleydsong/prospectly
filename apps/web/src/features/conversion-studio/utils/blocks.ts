import type { ButtonAction, PageBlock } from '../types/blocks';

export function resolveButtonHref(action: ButtonAction): string | null {
  switch (action.type) {
    case 'whatsapp': {
      const text = action.message ? `?text=${encodeURIComponent(action.message)}` : '';
      return `https://wa.me/${action.phone.replace(/\D/g, '')}${text}`;
    }
    case 'call':
      return `tel:${action.phone}`;
    case 'email': {
      const subject = action.subject ? `?subject=${encodeURIComponent(action.subject)}` : '';
      return `mailto:${action.email}${subject}`;
    }
    case 'external_url':
    case 'calendar': {
      const url = new URL(action.url);
      if (action.type === 'external_url') {
        if (action.utmSource) url.searchParams.set('utm_source', action.utmSource);
        if (action.utmMedium) url.searchParams.set('utm_medium', action.utmMedium);
        if (action.utmCampaign) url.searchParams.set('utm_campaign', action.utmCampaign);
      }
      return url.toString();
    }
    case 'anchor':
      return `#${action.anchor}`;
    case 'open_form':
      return `#block-${action.formBlockId}`;
  }
}

export function moveBlock(blocks: PageBlock[], id: string, direction: -1 | 1): PageBlock[] {
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) return blocks;
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}
