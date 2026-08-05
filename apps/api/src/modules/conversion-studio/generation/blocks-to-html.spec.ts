import type { PageBlock } from '../page-blocks.schema';
import { blocksToSimpleHtml } from './blocks-to-html';

describe('blocksToSimpleHtml', () => {
  it('creates a premium, motion-safe fallback when AI generation is unavailable', () => {
    const blocks: PageBlock[] = [
      {
        type: 'hero',
        id: 'hero',
        variant: 'zinc',
        headline: 'Cuidado que se vê em cada detalhe',
        subheadline: 'Uma experiência criada para si.',
        ctaLabel: 'Agendar agora',
        imageUrl: 'https://images.example.com/hero.jpg',
        imageAlt: 'Ambiente do estabelecimento',
      },
      {
        type: 'rich_text',
        id: 'about',
        title: 'Uma história com identidade',
        body: 'Atendimento atento e uma experiência feita com cuidado.',
        bullets: ['Atendimento personalizado'],
      },
      {
        type: 'contact_form',
        id: 'contact',
        title: 'Fale connosco',
        fields: ['name', 'email', 'message'],
        submitLabel: 'Enviar mensagem',
        privacyNotice: 'Os seus dados serão usados apenas para responder ao contacto.',
      },
    ];

    const html = blocksToSimpleHtml({
      title: 'Studio Aurora',
      companyName: 'Studio Aurora',
      blocks,
    });

    expect(html).toContain('class="hero"');
    expect(html).toContain('animation-timeline:view()');
    expect(html).toContain('prefers-reduced-motion:reduce');
    expect(html).toContain('class="site-header"');
    expect(html).not.toContain('<script');
  });
});
