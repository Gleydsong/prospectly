import type { SeoAudit, SeoSignals, WebsiteAnalysisResult } from '@prospectly/shared-types';

import { computeSeoAudit as computeSeoAuditNullable, SEO_VECTOR_CAPS } from './seo-audit';

function computeSeoAudit(result: WebsiteAnalysisResult): SeoAudit {
  const audit = computeSeoAuditNullable(result);
  if (!audit) throw new Error('expected audit');
  return audit;
}

function perfectSignals(overrides: Partial<SeoSignals> = {}): SeoSignals {
  return {
    renderingMode: 'SSR',
    visibleTextLength: 2500,
    noindex: false,
    canonicalUrl: 'https://www.exemplo.com.br/',
    h1Count: 1,
    titleLength: 45,
    metaDescriptionLength: 120,
    ogTitle: 'Exemplo',
    ogImage: 'https://www.exemplo.com.br/og.png',
    jsonLdTypes: ['LocalBusiness'],
    hasMicrodata: false,
    images: { total: 8, missingDimensions: 0, modernFormat: 6, missingAlt: 0 },
    thirdPartyScriptHosts: ['www.googletagmanager.com'],
    renderBlockingScripts: 0,
    hasAddress: true,
    mentionsCity: true,
    robotsBlocksAll: false,
    alternateHostRedirects: true,
    ...overrides,
  };
}

function perfectResult(overrides: Partial<WebsiteAnalysisResult> = {}): WebsiteAnalysisResult {
  return {
    url: 'https://www.exemplo.com.br/',
    accessible: true,
    httpStatus: 200,
    https: true,
    responseTimeMs: 400,
    title: 'Clínica Exemplo | Dentista em Curitiba',
    metaDescription: 'Clínica odontológica em Curitiba com atendimento humanizado e agendamento online.',
    hasViewport: true,
    hasPhone: true,
    hasRobotsTxt: true,
    hasSitemap: true,
    framework: 'Next.js',
    seo: perfectSignals(),
    issues: [],
    ...overrides,
  };
}

describe('computeSeoAudit', () => {
  it('scores a fully optimised SSR site as 100 / LOW opportunity', () => {
    const audit = computeSeoAudit(perfectResult());

    expect(audit.healthScore).toBe(100);
    expect(audit.opportunity).toBe('LOW');
    expect(audit.findings).toHaveLength(0);
    expect(audit.topIssues).toHaveLength(0);
    expect(audit.quickWins).toHaveLength(0);
    expect(audit.architecture).toBe('Next.js SSR');
    expect(audit.vectors.INDEXABILITY).toEqual({ score: 30, max: 30 });
  });

  it('flags a CSR shell without metadata as CRITICAL and ranks the worst issues first', () => {
    const audit = computeSeoAudit(
      perfectResult({
        title: undefined,
        metaDescription: undefined,
        hasViewport: false,
        hasRobotsTxt: false,
        hasSitemap: false,
        framework: 'React',
        seo: perfectSignals({
          renderingMode: 'CSR',
          visibleTextLength: 40,
          h1Count: 0,
          titleLength: undefined,
          metaDescriptionLength: undefined,
          ogTitle: undefined,
          ogImage: undefined,
          jsonLdTypes: [],
          canonicalUrl: undefined,
        }),
      }),
    );

    expect(audit.opportunity).toBe('CRITICAL');
    expect(audit.healthScore).toBeLessThan(40);
    expect(audit.architecture).toBe('React SPA (CSR)');
    expect(audit.topIssues).toHaveLength(3);
    expect(audit.topIssues[0]?.code).toBe('SEO_CSR_SHELL');
    expect(audit.topIssues.map((f) => f.points)).toEqual(
      [...audit.topIssues.map((f) => f.points)].sort((a, b) => b - a),
    );
    // Thin content is not double-counted when the page is a CSR shell.
    expect(audit.findings.some((f) => f.code === 'SEO_THIN_CONTENT')).toBe(false);
    expect(audit.quickWins.length).toBeLessThanOrEqual(2);
    expect(audit.quickWins.every((f) => f.quickWin)).toBe(true);
  });

  it('never deducts more than the vector cap', () => {
    const audit = computeSeoAudit(
      perfectResult({
        seo: perfectSignals({
          renderingMode: 'CSR',
          visibleTextLength: 0,
          noindex: true,
          robotsBlocksAll: true,
        }),
      }),
    );

    expect(audit.vectors.INDEXABILITY.score).toBe(0);
    expect(audit.healthScore).toBe(100 - SEO_VECTOR_CAPS.INDEXABILITY);
    expect(audit.opportunity).toBe('MEDIUM');
  });

  it('does not penalise checks whose signal could not be determined', () => {
    const audit = computeSeoAudit(
      perfectResult({
        hasRobotsTxt: undefined,
        hasSitemap: undefined,
        seo: perfectSignals({ alternateHostRedirects: undefined, mentionsCity: undefined }),
      }),
    );

    expect(audit.healthScore).toBe(100);
  });

  it('penalises missing local infrastructure signals (NAP, HTTPS, sitemap)', () => {
    const audit = computeSeoAudit(
      perfectResult({
        https: false,
        hasPhone: false,
        hasSitemap: false,
        seo: perfectSignals({ hasAddress: false }),
      }),
    );

    const codes = audit.findings.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(['SEO_NO_HTTPS', 'SEO_NO_NAP', 'SEO_NO_SITEMAP']));
    expect(audit.vectors.LOCAL_INFRA.score).toBe(SEO_VECTOR_CAPS.LOCAL_INFRA - 10 - 5 - 4);
  });

  it('flags image and script performance problems only with enough images', () => {
    const fewImages = computeSeoAudit(
      perfectResult({
        seo: perfectSignals({ images: { total: 2, missingDimensions: 2, modernFormat: 0, missingAlt: 0 } }),
      }),
    );
    expect(fewImages.findings.map((f) => f.code)).not.toContain('SEO_IMAGES_WITHOUT_DIMENSIONS');

    const manyImages = computeSeoAudit(
      perfectResult({
        seo: perfectSignals({
          images: { total: 10, missingDimensions: 8, modernFormat: 0, missingAlt: 3 },
          renderBlockingScripts: 4,
        }),
      }),
    );
    const codes = manyImages.findings.map((f) => f.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'SEO_IMAGES_WITHOUT_DIMENSIONS',
        'SEO_LEGACY_IMAGE_FORMATS',
        'SEO_RENDER_BLOCKING_SCRIPTS',
      ]),
    );
  });

  it('maps health score bands to opportunity levels', () => {
    const cases: Array<[Partial<WebsiteAnalysisResult>, string]> = [
      [{}, 'LOW'],
      // 100 - 18 (CSR) - 8 (no title) = 74 → MEDIUM
      [{ title: undefined, seo: perfectSignals({ renderingMode: 'CSR', titleLength: undefined }) }, 'MEDIUM'],
      // 74 - 10 (https) - 8 (viewport) = 56 → HIGH
      [
        {
          title: undefined,
          https: false,
          hasViewport: false,
          seo: perfectSignals({ renderingMode: 'CSR', titleLength: undefined }),
        },
        'HIGH',
      ],
    ];
    for (const [overrides, expected] of cases) {
      expect(computeSeoAudit(perfectResult(overrides)).opportunity).toBe(expected);
    }
  });

  it('prefers CMS over framework when labelling the architecture', () => {
    const wordpress = computeSeoAudit(
      perfectResult({ cms: 'WordPress', framework: undefined, seo: perfectSignals({ renderingMode: 'SSR' }) }),
    );
    expect(wordpress.architecture).toBe('WordPress');

    const staticSite = computeSeoAudit(
      perfectResult({ framework: undefined, seo: perfectSignals({ renderingMode: 'STATIC' }) }),
    );
    expect(staticSite.architecture).toBe('HTML estático/servidor');

    const unknown = computeSeoAudit(
      perfectResult({ framework: undefined, seo: perfectSignals({ renderingMode: 'UNKNOWN' }) }),
    );
    expect(unknown.architecture).toBe('Desconhecida');
  });

  it('returns null when the page could not be analysed', () => {
    expect(computeSeoAuditNullable(perfectResult({ seo: undefined }))).toBeNull();
    expect(computeSeoAuditNullable(perfectResult({ accessible: false }))).toBeNull();
  });
});
