import { applyGoogleMediaToBlocks } from './apply-google-media';
import { buildDesignReferenceBrief } from './design-references';
import type { PageBlock } from '../page-blocks.schema';

describe('buildDesignReferenceBrief', () => {
  it('returns beauty vertical for barbearia', () => {
    const brief = buildDesignReferenceBrief({ category: 'Barbearia', companyName: 'Nacuca' });
    expect(brief).toContain('barbearia');
    expect(brief).toContain('Hero full-bleed');
  });

  it('returns default vertical when unknown', () => {
    const brief = buildDesignReferenceBrief({ category: 'Outro', companyName: 'Empresa XYZ' });
    expect(brief).toContain('negócio local genérico');
  });
});

describe('applyGoogleMediaToBlocks', () => {
  const baseBlocks = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      type: 'hero',
      headline: 'Teste',
      variant: 'brand',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      type: 'rich_text',
      body: 'Sobre o negócio',
    },
  ] as PageBlock[];

  it('injects hero image and gallery from Google photos', () => {
    const result = applyGoogleMediaToBlocks(baseBlocks, {
      companyName: 'Barbearia Teste',
      photos: [
        { url: 'https://lh3.googleusercontent.com/a', alt: 'Foto 1' },
        { url: 'https://lh3.googleusercontent.com/b', alt: 'Foto 2' },
      ],
    });

    const hero = result.find((block) => block.type === 'hero');
    const gallery = result.find((block) => block.type === 'gallery');
    expect(hero && hero.type === 'hero' ? hero.imageUrl : null).toBe(
      'https://lh3.googleusercontent.com/a',
    );
    expect(gallery && gallery.type === 'gallery' ? gallery.images.length : 0).toBe(2);
  });

  it('replaces invented testimonials with Google reviews', () => {
    const withTestimonials = [
      ...baseBlocks,
      {
        id: '33333333-3333-3333-3333-333333333333',
        type: 'testimonials',
        title: 'O que dizem',
        items: [
          { quote: 'Recomendo muito.', author: 'Cliente local', role: 'SP' },
        ],
      },
    ] as PageBlock[];

    const result = applyGoogleMediaToBlocks(withTestimonials, {
      companyName: 'Clínica',
      photos: [{ url: 'https://lh3.googleusercontent.com/x', alt: 'X' }],
      googleReviews: [
        { quote: 'Atendimento impecável e pontual.', author: 'Maria', rating: 5 },
      ],
    });

    const testimonials = result.find((block) => block.type === 'testimonials');
    expect(
      testimonials && testimonials.type === 'testimonials' ? testimonials.items[0]?.author : null,
    ).toBe('Maria');
  });
});
