import { randomUUID } from 'node:crypto';

import type { PageBlock } from '../page-blocks.schema';
import type { LandingGenerationContext } from './providers/landing-generation.provider';

/**
 * Garante que fotos reais do Google entram no hero e na gallery,
 * mesmo se o modelo omitir imageUrl.
 */
export function applyGoogleMediaToBlocks(
  blocks: PageBlock[],
  context: LandingGenerationContext,
): PageBlock[] {
  const photos = context.photos ?? [];
  if (photos.length === 0) return blocks;

  let next = blocks.map((block) => {
    if (block.type !== 'hero') return block;
    if (block.imageUrl) return block;
    const first = photos[0];
    if (!first) return block;
    return {
      ...block,
      imageUrl: first.url,
      imageAlt: first.alt || `Foto de ${context.companyName}`,
    };
  });

  const hasGallery = next.some((block) => block.type === 'gallery');
  if (!hasGallery && photos.length >= 1) {
    const galleryImages = photos.slice(0, 8).map((photo) => ({
      url: photo.url,
      alt: photo.alt || `Foto de ${context.companyName}`,
    }));
    const gallery: PageBlock = {
      id: randomUUID(),
      type: 'gallery',
      title: 'Conheça o espaço',
      images: galleryImages,
    };

    const heroIndex = next.findIndex((block) => block.type === 'hero');
    const aboutIndex = next.findIndex((block) => block.type === 'rich_text');
    const insertAt =
      aboutIndex >= 0 ? aboutIndex + 1 : heroIndex >= 0 ? heroIndex + 1 : Math.min(2, next.length);
    next = [...next.slice(0, insertAt), gallery, ...next.slice(insertAt)];
  }

  if (context.googleReviews && context.googleReviews.length > 0) {
    next = next.map((block) => {
      if (block.type !== 'testimonials') return block;
      const invented = block.items.every(
        (item) =>
          /cliente local|avaliação recente|recomendo/i.test(item.quote) ||
          /cliente local|avaliação recente/i.test(item.author),
      );
      if (!invented && block.items.length > 0) return block;
      return {
        ...block,
        title: block.title || 'Avaliações no Google',
        items: context.googleReviews!.slice(0, 4).map((review) => ({
          quote: review.quote.slice(0, 600),
          author: review.author.slice(0, 80),
          role: typeof review.rating === 'number' ? `${review.rating.toFixed(1)}★ no Google` : 'Google',
        })),
      };
    });
  }

  return next;
}
