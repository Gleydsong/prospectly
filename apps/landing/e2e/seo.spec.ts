import { expect, test } from '@playwright/test';

test.describe('landing SEO', () => {
  test('home title does not duplicate the brand suffix', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(
      '<title>Encontre empresas para prospectar no Brasil | Prospectly</title>',
    );
    expect(html).not.toContain(
      '<title>Prospectly | Encontre empresas para prospectar no Brasil | Prospectly</title>',
    );
  });

  test('home advertises pt-BR canonical hreflang without a redirecting /en home', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text();
    expect(html).toMatch(/rel="alternate"[^>]*hrefLang="pt-BR"/);
    expect(html).toMatch(/rel="alternate"[^>]*hrefLang="x-default"/);
    expect(html).not.toMatch(/hrefLang="en"/);
  });

  test('pricing pairs pt-BR and en hreflang', async ({ request }) => {
    const html = await (await request.get('/pricing')).text();
    expect(html).toMatch(/hrefLang="pt-BR" href="[^"]*\/pricing"/);
    expect(html).toMatch(/hrefLang="en" href="[^"]*\/en\/pricing"/);
  });

  test('robots.txt allows Googlebot and Google-InspectionTool', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('User-Agent: Googlebot');
    expect(body).toContain('User-Agent: Google-InspectionTool');
    expect(body).toMatch(/Allow: \//);
    expect(body).not.toMatch(/Disallow:\s*\//);
  });
});
