import { ScoringService } from './scoring.service';

describe('ScoringService', () => {
  const makePrisma = () => {
    const prisma: Record<string, unknown> = {
      scoreConfiguration: {
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      scoreRule: {
        createMany: jest.fn(),
        update: jest.fn(),
      },
      lead: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      leadScore: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
    return prisma;
  };

  const queue = { add: jest.fn() };

  const baseLead = {
    id: 'l1',
    organizationId: 'o1',
    website: null as string | null,
    phone: '+5511999999999' as string | null,
    email: 'a@b.dev' as string | null,
    rating: 4.5 as number | null,
    reviewCount: 3 as number | null,
    status: 'NEW' as const,
    segment: 'restaurants' as string | null,
    doNotContact: false,
  };

  it('evaluateRules applies NO_WEBSITE and contact signals without analysis', () => {
    const service = new ScoringService(makePrisma() as never, queue as never);
    const result = service.evaluateRules(baseLead, null, [
      { key: 'NO_WEBSITE', points: 30, enabled: true },
      { key: 'HAS_PHONE', points: 5, enabled: true },
      { key: 'HAS_EMAIL', points: 5, enabled: false },
      { key: 'HIGH_RATING', points: 5, enabled: true },
    ]);
    expect(result.applied).toEqual([
      { key: 'NO_WEBSITE', points: 30, dimension: 'opportunity' },
      { key: 'HAS_PHONE', points: 5, dimension: 'fit' },
      { key: 'HIGH_RATING', points: 5, dimension: 'fit' },
    ]);
    expect(result.opportunity).toBe(30);
    expect(result.fit).toBe(10);
    expect(result.engagement).toBe(0);
    expect(result.score).toBe(40);
    expect(result.missingData).toContain('website');
    expect(result.recommendedAction).toBe('PRIORITIZE_OUTREACH');
  });

  it('evaluateRules applies website weakness rules from completed analysis', () => {
    const service = new ScoringService(makePrisma() as never, queue as never);
    const result = service.evaluateRules(
      {
        ...baseLead,
        website: 'http://example.com',
        phone: null,
        email: null,
        rating: null,
        reviewCount: 50,
      },
      {
        status: 'COMPLETED',
        https: false,
        hasViewport: false,
        responseTimeMs: 4500,
        hasContactForm: false,
        metaDescription: null,
        httpStatus: 200,
        error: null,
      },
      [
        { key: 'NO_HTTPS', points: 15, enabled: true },
        { key: 'NOT_RESPONSIVE', points: 20, enabled: true },
        { key: 'SLOW', points: 10, enabled: true },
        { key: 'NO_CONTACT_FORM', points: 8, enabled: true },
        { key: 'NO_META_DESCRIPTION', points: 5, enabled: true },
        { key: 'MANY_REVIEWS_BAD_SITE', points: 15, enabled: true },
      ],
    );
    expect(result.applied.map((item) => item.key)).toEqual([
      'NO_HTTPS',
      'NOT_RESPONSIVE',
      'SLOW',
      'NO_CONTACT_FORM',
      'NO_META_DESCRIPTION',
      'MANY_REVIEWS_BAD_SITE',
    ]);
    expect(result.applied.every((item) => item.dimension === 'opportunity')).toBe(true);
    expect(result.opportunity).toBe(73);
    expect(result.fit).toBe(0);
    expect(result.missingData).toEqual(
      expect.arrayContaining(['phone', 'email', 'rating']),
    );
    expect(result.recommendedAction).toBe('ENRICH_CONTACT');
  });

  it('evaluateRules dimensions include engagement from status and activities', () => {
    const service = new ScoringService(makePrisma() as never, queue as never);
    const result = service.evaluateRules(
      {
        ...baseLead,
        website: 'https://ok.dev',
        status: 'MEETING_SCHEDULED',
        phone: '+5511999999999',
        email: 'a@b.dev',
      },
      null,
      [
        { key: 'HAS_PHONE', points: 5, enabled: true },
        { key: 'HAS_EMAIL', points: 5, enabled: true },
        { key: 'ENGAGEMENT_CONTACTED', points: 4, enabled: true },
        { key: 'ENGAGEMENT_RESPONDED', points: 6, enabled: true },
        { key: 'ENGAGEMENT_MEETING', points: 8, enabled: true },
        { key: 'ENGAGEMENT_ACTIVITY', points: 4, enabled: true },
      ],
      { activityTypes: ['CALL', 'NOTE'] },
    );

    expect(result.applied.map((item) => item.key)).toEqual([
      'HAS_PHONE',
      'HAS_EMAIL',
      'ENGAGEMENT_CONTACTED',
      'ENGAGEMENT_RESPONDED',
      'ENGAGEMENT_MEETING',
      'ENGAGEMENT_ACTIVITY',
    ]);
    expect(result.fit).toBe(10);
    expect(result.opportunity).toBe(0);
    expect(result.engagement).toBe(22);
    expect(result.recommendedAction).toBe('ADVANCE_PIPELINE');
  });

  it('updateRules enqueues org recalculation', async () => {
    const prisma = makePrisma();
    (prisma.scoreConfiguration as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      id: 'cfg1',
      organizationId: 'o1',
      version: 1,
      rules: [{ key: 'NO_WEBSITE', points: 30, enabled: true }],
    });
    (prisma.scoreConfiguration as { findFirstOrThrow: jest.Mock }).findFirstOrThrow.mockResolvedValue({
      id: 'cfg1',
      rules: [{ key: 'NO_WEBSITE', points: 25, enabled: false }],
    });
    (prisma.scoreRule as { createMany: jest.Mock }).createMany.mockResolvedValue({ count: 9 });
    (prisma.scoreRule as { update: jest.Mock }).update.mockResolvedValue({});
    (prisma.scoreConfiguration as { update: jest.Mock }).update.mockResolvedValue({});

    const service = new ScoringService(prisma as never, queue as never);
    await service.updateRules('o1', [{ key: 'NO_WEBSITE', points: 25, enabled: false }]);
    expect(queue.add).toHaveBeenCalled();
    expect((prisma.scoreRule as { update: jest.Mock }).update).toHaveBeenCalled();
  });

  it('recalculateOrganization paginates beyond 5000 with cursor batches', async () => {
    const prisma = makePrisma();
    const service = new ScoringService(prisma as never, queue as never);
    const recalculate = jest
      .spyOn(service, 'recalculate')
      .mockResolvedValue({
        score: 1,
        fit: 0,
        opportunity: 1,
        engagement: 0,
        tier: 'LOW',
        appliedRules: [],
        missingData: [],
        recommendedAction: 'NURTURE',
        configVersion: 1,
      });

    const batchSize = 1000;
    let calls = 0;
    (prisma.lead as { findMany: jest.Mock }).findMany.mockImplementation(
      async ({ take }: { take: number }) => {
        calls += 1;
        if (calls > 6) {
          return [];
        }
        const offset = (calls - 1) * take;
        return Array.from({ length: take }, (_, index) => ({ id: `lead-${offset + index}` }));
      },
    );

    const count = await service.recalculateOrganization('o1', {
      batchSize,
      concurrency: 10,
    });

    expect(count).toBe(6000);
    expect(recalculate).toHaveBeenCalledTimes(6000);
    expect((prisma.lead as { findMany: jest.Mock }).findMany.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect((prisma.lead as { findMany: jest.Mock }).findMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        skip: 1,
        cursor: { id: 'lead-999' },
        take: batchSize,
      }),
    );
  });
});
