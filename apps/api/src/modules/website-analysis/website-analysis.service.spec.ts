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
});
