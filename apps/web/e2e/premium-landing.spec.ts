import { expect, test } from '@playwright/test';

import type { PageBlock } from '../../api/src/modules/conversion-studio/page-blocks.schema';
import { blocksToSimpleHtml } from '../../api/src/modules/conversion-studio/generation/blocks-to-html';

const PREMIUM_LANDING_HTML = blocksToSimpleHtml({
  title: 'Casa Aurora',
  companyName: 'Casa Aurora',
  blocks: [
    {
      type: 'hero',
      id: '2d6b6753-fdb8-4fb4-a361-bdda59877b8c',
      variant: 'zinc',
      headline: 'Cozinha de memória, servida com calma.',
      subheadline: 'Sabores brasileiros, ingredientes de perto e uma mesa para ficar.',
      ctaLabel: 'Reservar uma mesa',
      imageUrl:
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=85',
      imageAlt: 'Mesa posta no restaurante Casa Aurora',
    },
    {
      type: 'rich_text',
      id: '2d6b6753-fdb8-4fb4-a361-bdda59877b8d',
      title: 'Receitas que respeitam o tempo.',
      body: 'A Casa Aurora reúne cozinha brasileira, ingredientes sazonais e hospitalidade num espaço feito para almoços sem pressa e encontros especiais.',
      bullets: ['Ingredientes sazonais', 'Cozinha brasileira', 'Ambiente acolhedor'],
    },
    {
      type: 'gallery',
      id: '2d6b6753-fdb8-4fb4-a361-bdda59877b8e',
      title: 'Um lugar para voltar.',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85',
          alt: 'Prato servido pela Casa Aurora',
        },
        {
          url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
          alt: 'Salão do restaurante',
        },
        {
          url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=85',
          alt: 'Detalhe da mesa posta',
        },
      ],
    },
    {
      type: 'service_card',
      id: '2d6b6753-fdb8-4fb4-a361-bdda59877b8f',
      title: 'Almoço à la carte',
      description: 'Pratos autorais preparados com ingredientes frescos e receitas de temporada.',
      highlight: true,
      layout: 'stack',
    },
    {
      type: 'service_card',
      id: '42df1cfb-3b54-4e40-9c31-af05f9435728',
      title: 'Jantares especiais',
      description: 'Uma experiência intimista para celebrar, encontrar e saborear com tempo.',
      highlight: false,
      layout: 'stack',
    },
    {
      type: 'testimonials',
      id: '2d6b6753-fdb8-4fb4-a361-bdda59877b8b',
      title: 'O que fica na memória',
      items: [
        { quote: 'Comida impecável e um serviço atento do início ao fim.', author: 'Marina R.' },
        { quote: 'Um dos lugares mais agradáveis para um almoço demorado.', author: 'João P.' },
        { quote: 'O ambiente e os sabores fazem querer voltar.', author: 'Clara M.' },
      ],
    },
    {
      type: 'contact_form',
      id: '2d6b6753-fdb8-4fb4-a361-bdda59877b8a',
      title: 'Reserve o seu momento',
      fields: ['name', 'email', 'message'],
      submitLabel: 'Enviar pedido',
      privacyNotice: 'Usamos os seus dados apenas para responder ao seu pedido.',
    },
    {
      type: 'footer',
      id: '473b5b43-508f-41be-9ef9-29a92300dcbd',
      text: 'Casa Aurora · Cozinha brasileira contemporânea',
      showProspectlyBrand: true,
    },
  ] as PageBlock[],
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/public/pages/casa-aurora', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Casa Aurora',
        publicSlug: 'casa-aurora',
        version: 1,
        html: PREMIUM_LANDING_HTML,
        blocks: [],
        analytics: { enabled: false, consentLabel: '' },
      }),
    });
  });
  await page.route('**/api/v1/public/pages/casa-aurora/events', async (route) => {
    await route.fulfill({ status: 201, body: JSON.stringify({ ok: true }) });
  });
});

test('renders a premium generated landing without allowing generated scripts', async ({ page }, testInfo) => {
  await page.goto('/p/casa-aurora');

  const landing = page.frameLocator('iframe[title="Casa Aurora"]');
  await expect(landing.locator('h1')).toHaveText('Cozinha de memória, servida com calma.');
  await expect(landing.locator('.hero')).toBeVisible();
  await expect(landing.locator('.cta')).toContainText('Reservar uma mesa');
  await expect(landing.locator('.gallery-grid figure')).toHaveCount(3);
  await expect(landing.locator('.quote-grid blockquote')).toHaveCount(3);
  await expect(landing.locator('script')).toHaveCount(0);

  const motionStyles = await landing.locator('style').textContent();
  expect(motionStyles).toContain('animation-timeline:view()');
  expect(motionStyles).toContain('prefers-reduced-motion:reduce');

  const iframeHeight = page.locator('iframe[title="Casa Aurora"]');
  await expect
    .poll(() =>
      iframeHeight.evaluate((element) => {
        const iframe = element as HTMLIFrameElement;
        const doc = iframe.contentDocument;
        const contentHeight = Math.max(
          doc?.body.scrollHeight ?? 0,
          doc?.documentElement.scrollHeight ?? 0,
        );
        return iframe.clientHeight >= contentHeight - 4;
      }),
    )
    .toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('premium-landing.png'), fullPage: true });
});
