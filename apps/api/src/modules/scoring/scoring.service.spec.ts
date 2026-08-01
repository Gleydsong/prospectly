import { DEFAULT_SCORE_RULES } from './scoring.constants';
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

  it('evaluateRules applies NO_WEBSITE and contact signals without analysis', () => {
    const service = new ScoringService(makePrisma() as never, queue as never);
    const applied = service.evaluateRules(
      {
        id: 'l1',
        organizationId: 'o1',
        website: null,
        phone: '+5511999999999',
        email: 'a@b.dev',
        rating: 4.5,
        reviewCount: 3,
      },
      null,
      [
        { key: 'NO_WEBSITE', points: 30, enabled: true },
        { key: 'HAS_PHONE', points: 5, enabled: true },
        { key: 'HAS_EMAIL', points: 5, enabled: false },
        { key: 'HIGH_RATING', points: 5, enabled: true },
      ],
    );
    expect(applied).toEqual([
      { key: 'NO_WEBSITE', points: 30 },
      { key: 'HAS_PHONE', points: 5 },
      { key: 'HIGH_RATING', points: 5 },
    ]);
  });

  it('evaluateRules applies website weakness rules from completed analysis', () => {
    const service = new ScoringService(makePrisma() as never, queue as never);
    const applied = service.evaluateRules(
      {
        id: 'l1',
        organizationId: 'o1',
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
    expect(applied.map((item) => item.key)).toEqual([
      'NO_HTTPS',
      'NOT_RESPONSIVE',
      'SLOW',
      'NO_CONTACT_FORM',
      'NO_META_DESCRIPTION',
      'MANY_REVIEWS_BAD_SITE',
    ]);
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
    await service.updateRules('o1', [{ key: 'NO_WEBSITE', points: 25, enabled: false }], 'corr-score-1');
    expect(queue.add).toHaveBeenCalledWith(
      'recalculate-org-scores',
      { organizationId: 'o1', correlationId: 'corr-score-1' },
      expect.any(Object),
    );
    expect((prisma.scoreRule as { update: jest.Mock }).update).toHaveBeenCalled();
  });

  it('NO_WEBSITE description avoids definitive absence wording', () => {
    const rule = DEFAULT_SCORE_RULES.find((item) => item.key === 'NO_WEBSITE');
    expect(rule?.description.toLowerCase()).not.toContain('sem website');
    expect(rule?.description.toLowerCase()).toContain('não informado');
  });

});
