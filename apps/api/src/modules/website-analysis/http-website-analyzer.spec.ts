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
