jest.mock('./ssrf', () => {
  const actual = jest.requireActual('./ssrf') as typeof import('./ssrf');
  return {
    ...actual,
    assertSafePublicUrl: jest.fn(async (url: string) => ({
      url: new URL(url),
      addresses: ['93.184.216.34'],
    })),
  };
});

import {
  HttpWebsiteAnalyzer,
  parseHtmlSignals,
  readBodyWithLimit,
} from './http-website-analyzer';
import { alternateHostname, parseSeoSignals, robotsBlocksAll, robotsDeclaresSitemap } from './seo-signals';

function streamResponse(chunks: Uint8Array[], contentType = 'text/html; charset=utf-8') {
  let index = 0;
  let cancelled = false;
  return {
    status: 200,
    ok: true,
    headers: {
      get: (name: string) => (name === 'content-type' ? contentType : null),
    },
    body: {
      getReader() {
        return {
          async read() {
            if (cancelled || index >= chunks.length) {
              return { done: true as const, value: undefined };
            }
            const value = chunks[index]!;
            index += 1;
            return { done: false as const, value };
          },
          async cancel() {
            cancelled = true;
          },
        };
      },
      async cancel() {
        cancelled = true;
      },
    },
    arrayBuffer: async () => {
      throw new Error('arrayBuffer should not be used when body stream is available');
    },
    wasCancelled: () => cancelled,
  };
}

describe('readBodyWithLimit', () => {
  it('stops reading once maxBodyBytes is reached and cancels the stream', async () => {
    const chunkA = Buffer.alloc(100, 0x61); // 'a'
    const chunkB = Buffer.alloc(100, 0x62); // 'b'
    const chunkC = Buffer.alloc(100, 0x63); // 'c'
    const response = streamResponse([chunkA, chunkB, chunkC]);

    const buffer = await readBodyWithLimit(response, 150);

    expect(buffer.byteLength).toBe(150);
    expect(buffer.subarray(0, 100).every((byte) => byte === 0x61)).toBe(true);
    expect(buffer.subarray(100).every((byte) => byte === 0x62)).toBe(true);
    expect(response.wasCancelled()).toBe(true);
  });
});

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

describe('parseSeoSignals', () => {
  const longText = 'Clínica odontológica em Curitiba com atendimento humanizado. '.repeat(10);

  it('classifies a Next.js page with server-rendered content as SSR and extracts on-page signals', () => {
    const html = `
      <html><head>
        <title>Clínica Demo | Dentista em Curitiba</title>
        <meta name="description" content="Clínica odontológica em Curitiba com atendimento humanizado e agendamento online." />
        <meta name="viewport" content="width=device-width" />
        <meta property="og:title" content="Clínica Demo" />
        <meta property="og:image" content="https://demo.dev/og.png" />
        <link rel="canonical" href="https://demo.dev/" />
        <script src="/_next/static/chunks/main.js" defer></script>
        <script src="https://www.googletagmanager.com/gtag/js"></script>
        <script src="https://cdn.other.com/a.js"></script>
        <script src="https://cdn.other.com/b.js"></script>
        <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"LocalBusiness"},{"@type":"WebSite"}]}</script>
      </head><body>
        <div id="__next">
          <h1>Dentista em Curitiba</h1>
          <p>${longText}</p>
          <img src="/a.webp" width="400" height="300" alt="a" />
          <img src="/b.jpg" alt="b" />
          <img src="/c.png" width="10" height="10" />
          <footer>Rua das Flores, 123 - Centro, Curitiba - PR, CEP 80010-000 <a href="tel:+554133334444">Ligue</a></footer>
        </div>
      </body></html>
    `;
    const { seo, framework } = parseSeoSignals(html, 'https://demo.dev/', { city: 'Curitiba' }, {
      title: 'Clínica Demo | Dentista em Curitiba',
      metaDescription: 'x'.repeat(90),
    });

    expect(framework).toBe('Next.js');
    expect(seo.renderingMode).toBe('SSR');
    expect(seo.h1Count).toBe(1);
    expect(seo.canonicalUrl).toBe('https://demo.dev/');
    expect(seo.noindex).toBe(false);
    expect(seo.ogTitle).toBe('Clínica Demo');
    expect(seo.ogImage).toBe('https://demo.dev/og.png');
    expect(seo.jsonLdTypes).toEqual(['LocalBusiness', 'WebSite']);
    expect(seo.images).toEqual({ total: 3, missingDimensions: 1, modernFormat: 1, missingAlt: 1 });
    expect(seo.thirdPartyScriptHosts).toEqual(['www.googletagmanager.com', 'cdn.other.com']);
    expect(seo.renderBlockingScripts).toBe(3);
    expect(seo.hasAddress).toBe(true);
    expect(seo.mentionsCity).toBe(true);
    expect(seo.titleLength).toBe(35);
    expect(seo.metaDescriptionLength).toBe(90);
    expect(seo.visibleTextLength).toBeGreaterThan(300);
  });

  it('classifies an empty React mount with a bundle as CSR', () => {
    const html = `
      <!doctype html><html><head><meta charset="utf-8"><title>App</title>
        <script type="module" src="/assets/index-abc123.js"></script>
      </head><body><div id="root"></div></body></html>
    `;
    const { seo } = parseSeoSignals(html, 'https://spa.dev/');
    expect(seo.renderingMode).toBe('CSR');
    expect(seo.h1Count).toBe(0);
    expect(seo.visibleTextLength).toBeLessThan(200);
    expect(seo.mentionsCity).toBeUndefined();
    expect(seo.renderBlockingScripts).toBe(0);
  });

  it('classifies plain HTML without a JS framework as STATIC and detects noindex', () => {
    const html = `<html><head><meta name="robots" content="noindex, nofollow"></head><body><h1>A</h1><h1>B</h1><p>${longText}</p></body></html>`;
    const { seo, framework } = parseSeoSignals(html, 'http://old.dev/');
    expect(framework).toBeUndefined();
    expect(seo.renderingMode).toBe('STATIC');
    expect(seo.noindex).toBe(true);
    expect(seo.h1Count).toBe(2);
    expect(seo.hasAddress).toBe(false);
  });

  it('parses robots.txt directives', () => {
    expect(robotsBlocksAll('User-agent: *\nDisallow: /')).toBe(true);
    expect(robotsBlocksAll('User-agent: *\nDisallow: /admin/\nSitemap: https://x/sitemap.xml')).toBe(false);
    expect(robotsBlocksAll('User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow:')).toBe(false);
    expect(robotsDeclaresSitemap('User-agent: *\nSitemap: https://x/sitemap.xml')).toBe(true);
    expect(alternateHostname('www.demo.dev')).toBe('demo.dev');
    expect(alternateHostname('demo.dev')).toBe('www.demo.dev');
    expect(alternateHostname('93.184.216.34')).toBeUndefined();
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

  it('uses injected fetchImpl with pinned addresses from assertSafePublicUrl', async () => {
    const { assertSafePublicUrl } = jest.requireMock('./ssrf') as {
      assertSafePublicUrl: jest.Mock;
    };
    assertSafePublicUrl.mockResolvedValue({
      url: new URL('https://example.com'),
      addresses: ['93.184.216.34'],
    });

    const html =
      '<html><head><title>Ok</title><meta name="viewport" content="width=device-width" /></head><body></body></html>';
    const fetchImpl = jest.fn().mockResolvedValue(streamResponse([Buffer.from(html)]));
    const analyzer = new HttpWebsiteAnalyzer({ fetchImpl: fetchImpl as never });
    const result = await analyzer.analyze('https://example.com');
    expect(result.accessible).toBe(true);
    expect(result.https).toBe(true);
    expect(result.title).toBe('Ok');
    expect(result.hasViewport).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/',
      expect.objectContaining({ method: 'GET', redirect: 'manual' }),
    );
  });

  it('collects robots/sitemap/www signals through auxiliary requests and attaches SEO signals', async () => {
    const { assertSafePublicUrl } = jest.requireMock('./ssrf') as { assertSafePublicUrl: jest.Mock };
    assertSafePublicUrl.mockImplementation(async (url: string) => ({
      url: new URL(url),
      addresses: ['93.184.216.34'],
    }));

    const html =
      '<html><head><title>Ok</title></head><body><div id="root"></div><script src="/assets/index-1a2b3c.js"></script></body></html>';
    const fetchImpl = jest.fn(async (url: string) => {
      if (url === 'https://www.demo.dev/') return streamResponse([Buffer.from(html)]);
      if (url === 'https://www.demo.dev/robots.txt') {
        return streamResponse(
          [Buffer.from('User-agent: *\nDisallow: /wp-admin/\nSitemap: https://www.demo.dev/sitemap_index.xml')],
          'text/plain',
        );
      }
      if (url === 'https://www.demo.dev/sitemap.xml') {
        return { ...streamResponse([Buffer.alloc(0)], 'text/html'), status: 404, ok: false };
      }
      if (url === 'https://demo.dev/') {
        return {
          ...streamResponse([Buffer.alloc(0)]),
          status: 301,
          ok: false,
          headers: { get: (name: string) => (name === 'location' ? 'https://www.demo.dev/' : null) },
        };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const analyzer = new HttpWebsiteAnalyzer({ fetchImpl: fetchImpl as never });
    const result = await analyzer.analyze('https://www.demo.dev/', { city: 'Curitiba' });

    expect(result.accessible).toBe(true);
    expect(result.hasRobotsTxt).toBe(true);
    expect(result.hasSitemap).toBe(true);
    expect(result.framework).toBeUndefined();
    expect(result.seo?.renderingMode).toBe('CSR');
    expect(result.seo?.robotsBlocksAll).toBe(false);
    expect(result.seo?.alternateHostRedirects).toBe(true);
    expect(result.seo?.mentionsCity).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('treats auxiliary request failures as unknown without failing the analysis', async () => {
    const { assertSafePublicUrl } = jest.requireMock('./ssrf') as { assertSafePublicUrl: jest.Mock };
    assertSafePublicUrl.mockImplementation(async (url: string) => ({
      url: new URL(url),
      addresses: ['93.184.216.34'],
    }));

    const html = '<html><head><title>Ok</title></head><body><p>Hello world</p></body></html>';
    const fetchImpl = jest.fn(async (url: string) => {
      if (url === 'https://demo.dev/') return streamResponse([Buffer.from(html)]);
      throw new Error('network down');
    });

    const analyzer = new HttpWebsiteAnalyzer({ fetchImpl: fetchImpl as never });
    const result = await analyzer.analyze('https://demo.dev/');

    expect(result.accessible).toBe(true);
    expect(result.hasRobotsTxt).toBeUndefined();
    expect(result.hasSitemap).toBeUndefined();
    expect(result.seo?.robotsBlocksAll).toBeUndefined();
    expect(result.seo?.alternateHostRedirects).toBeUndefined();
    expect(result.seo?.renderingMode).toBe('STATIC');
  });

  it('does not buffer an entire oversized HTML body into memory', async () => {
    const prefix =
      '<html><head><title>Huge</title><meta name="viewport" content="width=device-width" /></head><body>';
    const suffix = '</body></html>';
    const oversized = Buffer.concat([
      Buffer.from(prefix),
      Buffer.alloc(2_000_000, 0x58),
      Buffer.from(suffix),
    ]);
    // Deliver as one large chunk — limit must still truncate before keeping the whole payload.
    const response = streamResponse([oversized]);
    const fetchImpl = jest.fn().mockResolvedValue(response);
    const analyzer = new HttpWebsiteAnalyzer({
      fetchImpl: fetchImpl as never,
      maxBodyBytes: 8_000,
    });

    const result = await analyzer.analyze('https://evil.example/huge');
    expect(result.accessible).toBe(true);
    expect(result.title).toBe('Huge');
    expect(response.wasCancelled()).toBe(true);
  });
});
