jest.mock('./ssrf', () => {
  const actual = jest.requireActual('./ssrf') as typeof import('./ssrf');
  return {
    ...actual,
    assertSafePublicUrl: jest.fn(async (url: string) => new URL(url)),
  };
});

import { HttpWebsiteAnalyzer, parseHtmlSignals } from './http-website-analyzer';

describe('parseHtmlSignals', () => {
  it('extracts core SEO and contact signals from HTML', () => {
    const html = `
      <html><head>
        <title>Demo Clinic</title>
        <meta name="description" content="Health services" />
        <meta name="viewport" content="width=device-width" />
        <meta property="og:title" content="Demo" />
        <link rel="icon" href="/favicon.ico" />
      </head><body>
        <form><input type="email" name="email" /></form>
        <a href="mailto:contato@demo.dev">email</a>
        <a href="https://wa.me/5511999999999">whatsapp</a>
        <a href="https://instagram.com/demo">ig</a>
        <script type="application/ld+json">{}</script>
      </body></html>
    `;
    const signals = parseHtmlSignals(html, 'https://demo.dev');
    expect(signals.title).toBe('Demo Clinic');
    expect(signals.metaDescription).toBe('Health services');
    expect(signals.hasViewport).toBe(true);
    expect(signals.hasContactForm).toBe(true);
    expect(signals.hasEmail).toBe(true);
    expect(signals.hasWhatsapp).toBe(true);
    expect(signals.hasSocialLinks).toBe(true);
    expect(signals.hasOpenGraph).toBe(true);
    expect(signals.hasStructuredData).toBe(true);
  });
});

describe('HttpWebsiteAnalyzer', () => {
  it('returns SSRF blocked result for private hosts without fetching', async () => {
    const { assertSafePublicUrl, SsrfBlockedError } = jest.requireMock('./ssrf') as {
      assertSafePublicUrl: jest.Mock;
      SsrfBlockedError: new (message: string) => Error;
    };
    assertSafePublicUrl.mockRejectedValueOnce(new SsrfBlockedError('Private IP addresses are not allowed'));

    const fetchImpl = jest.fn();
    const analyzer = new HttpWebsiteAnalyzer({ fetchImpl: fetchImpl as never });
    const result = await analyzer.analyze('http://127.0.0.1/secret');
    expect(result.accessible).toBe(false);
    expect(result.issues[0]?.code).toBe('SSRF_BLOCKED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('parses a successful HTML response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: {
        get: (name: string) => (name === 'content-type' ? 'text/html; charset=utf-8' : null),
      },
      arrayBuffer: async () =>
        Buffer.from(
          '<html><head><title>Ok</title><meta name="viewport" content="width=device-width" /></head><body></body></html>',
        ),
    });
    const analyzer = new HttpWebsiteAnalyzer({ fetchImpl: fetchImpl as never });
    const result = await analyzer.analyze('https://example.com');
    expect(result.accessible).toBe(true);
    expect(result.https).toBe(true);
    expect(result.title).toBe('Ok');
    expect(result.hasViewport).toBe(true);
  });
});
