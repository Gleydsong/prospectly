import { NotFoundException } from '@nestjs/common';

import { WebsiteAnalysisService } from './website-analysis.service';

describe('WebsiteAnalysisService.onLeadUpsert', () => {
  it('soft-fails when scoring recalculate rejects for a no-website lead', async () => {
    const scoring = {
      recalculate: jest.fn().mockRejectedValue(new NotFoundException('Lead not found')),
    };
    const service = new WebsiteAnalysisService(
      {} as never,
      scoring as never,
      {} as never,
      {} as never,
    );

    await expect(service.onLeadUpsert('org-1', 'lead-1', null)).resolves.toBeUndefined();
    expect(scoring.recalculate).toHaveBeenCalledWith('lead-1');
  });

  it('soft-fails when website enqueue rejects', async () => {
    const prisma = {
      lead: {
        findFirst: jest.fn().mockRejectedValue(new Error('db down')),
      },
    };
    const scoring = { recalculate: jest.fn() };
    const queue = { add: jest.fn() };
    const service = new WebsiteAnalysisService(
      prisma as never,
      scoring as never,
      {} as never,
      queue as never,
    );

    await expect(
      service.onLeadUpsert('org-1', 'lead-1', 'https://example.com'),
    ).resolves.toBeUndefined();
    expect(scoring.recalculate).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});

describe('WebsiteAnalysisService.enqueueForLead', () => {
  it('returns queued even when Redis enqueue fails so PostgreSQL remains the source of truth', async () => {
    const prisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lead-1', website: 'https://example.com' }),
      },
      website: {
        findUnique: jest.fn().mockResolvedValue({ id: 'web-1', url: 'https://example.com' }),
        create: jest.fn(),
        update: jest.fn(),
      },
      websiteAnalysis: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'an-1', status: 'PENDING' }),
        findMany: jest.fn(),
      },
    };
    const queue = { add: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const service = new WebsiteAnalysisService(
      prisma as never,
      { recalculate: jest.fn() } as never,
      {} as never,
      queue as never,
    );

    await expect(service.enqueueForLead('org-1', 'lead-1')).resolves.toEqual({
      queued: true,
      analysisId: 'an-1',
      status: 'PENDING',
    });
    expect(prisma.websiteAnalysis.create).toHaveBeenCalled();
  });

  it('re-enqueues a PENDING analysis after Redis loss', async () => {
    const prisma = {
      websiteAnalysis: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'an-stale',
            website: {
              url: 'https://example.com',
              lead: { id: 'lead-1', organizationId: 'org-1' },
            },
          },
        ]),
      },
    };
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const service = new WebsiteAnalysisService(
      prisma as never,
      { recalculate: jest.fn() } as never,
      {} as never,
      queue as never,
    );

    await expect(service.reconcilePending()).resolves.toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      'analyze-website',
      expect.objectContaining({
        organizationId: 'org-1',
        leadId: 'lead-1',
        analysisId: 'an-stale',
        url: 'https://example.com',
      }),
      expect.objectContaining({ jobId: 'analyze-lead-1-an-stale' }),
    );
  });

  it('records recovered metrics when a RUNNING analysis is republished', async () => {
    const prisma = {
      websiteAnalysis: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'an-running',
            status: 'RUNNING',
            website: {
              url: 'https://example.com',
              lead: { id: 'lead-1', organizationId: 'org-1' },
            },
          },
        ]),
      },
    };
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const metrics = { recordJobRecovered: jest.fn() };
    const service = new WebsiteAnalysisService(
      prisma as never,
      { recalculate: jest.fn() } as never,
      {} as never,
      queue as never,
      metrics as never,
    );

    await expect(service.reconcilePending()).resolves.toBe(1);
    expect(metrics.recordJobRecovered).toHaveBeenCalledTimes(1);
  });
});

describe('WebsiteAnalysisService.processAnalysis', () => {
  function buildPrisma() {
    const tx = {
      websiteAnalysisIssue: { deleteMany: jest.fn() },
      websiteAnalysis: { update: jest.fn() },
      lead: { update: jest.fn() },
    };
    const prisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lead-1', city: 'Curitiba', state: 'PR' }),
      },
      websiteAnalysis: {
        findUnique: jest.fn().mockResolvedValue({ id: 'an-1' }),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => fn(tx)),
    };
    return { prisma, tx };
  }

  const job = { organizationId: 'org-1', leadId: 'lead-1', analysisId: 'an-1', url: 'https://demo.dev' };

  it('passes lead context to the analyzer and persists the SEO audit plus SEO issues', async () => {
    const { prisma, tx } = buildPrisma();
    const analyzer = {
      analyze: jest.fn().mockResolvedValue({
        url: 'https://demo.dev/',
        accessible: true,
        httpStatus: 200,
        https: true,
        responseTimeMs: 500,
        title: 'Demo',
        hasViewport: true,
        hasPhone: true,
        seo: {
          renderingMode: 'CSR',
          visibleTextLength: 10,
          noindex: false,
          h1Count: 0,
          jsonLdTypes: [],
          hasMicrodata: false,
          images: { total: 0, missingDimensions: 0, modernFormat: 0, missingAlt: 0 },
          thirdPartyScriptHosts: [],
          renderBlockingScripts: 0,
          hasAddress: true,
        },
        issues: [{ code: 'NO_META_DESCRIPTION', severity: 'INFO', message: 'Missing meta description' }],
      }),
    };
    const scoring = { recalculate: jest.fn() };
    const service = new WebsiteAnalysisService(prisma as never, scoring as never, analyzer as never, {} as never);

    await service.processAnalysis(job);

    expect(analyzer.analyze).toHaveBeenCalledWith('https://demo.dev', { city: 'Curitiba', state: 'PR' });
    const update = tx.websiteAnalysis.update.mock.calls[0]?.[0] as {
      data: {
        status: string;
        seoHealthScore: number | null;
        seoOpportunity: string | null;
        architecture: string | null;
        seoAudit: { findings: unknown[] } | null;
        issues: { create: Array<{ code: string; severity: string }> };
      };
    };
    expect(update.data.status).toBe('COMPLETED');
    expect(update.data.seoHealthScore).toBeLessThan(100);
    expect(update.data.seoOpportunity).toEqual(expect.stringMatching(/LOW|MEDIUM|HIGH|CRITICAL/));
    expect(update.data.architecture).toBe('SPA (CSR)');
    expect(update.data.seoAudit?.findings.length).toBeGreaterThan(0);
    const codes = update.data.issues.create.map((issue) => issue.code);
    expect(codes).toContain('NO_META_DESCRIPTION');
    expect(codes).toContain('SEO_CSR_SHELL');
    expect(update.data.issues.create.find((issue) => issue.code === 'SEO_CSR_SHELL')?.severity).toBe('CRITICAL');
    expect(scoring.recalculate).toHaveBeenCalledWith('lead-1');
  });

  it('stores null SEO fields when the page was not analysable', async () => {
    const { prisma, tx } = buildPrisma();
    const analyzer = {
      analyze: jest.fn().mockResolvedValue({
        url: 'https://demo.dev/',
        accessible: false,
        https: true,
        issues: [{ code: 'FETCH_FAILED', severity: 'CRITICAL', message: 'timeout' }],
        error: 'timeout',
      }),
    };
    const service = new WebsiteAnalysisService(
      prisma as never,
      { recalculate: jest.fn() } as never,
      analyzer as never,
      {} as never,
    );

    await service.processAnalysis(job);

    const update = tx.websiteAnalysis.update.mock.calls[0]?.[0] as {
      data: { status: string; seoHealthScore: number | null; seoOpportunity: string | null; architecture: string | null };
    };
    expect(update.data.status).toBe('FAILED');
    expect(update.data.seoHealthScore).toBeNull();
    expect(update.data.seoOpportunity).toBeNull();
    expect(update.data.architecture).toBeNull();
  });
});
