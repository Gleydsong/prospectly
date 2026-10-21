import type { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const makePrisma = () => {
  const prisma = {
    lead: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    leadActivity: { findMany: jest.fn().mockResolvedValue([]) },
    task: { count: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    search: { count: jest.fn() },
    organization: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return prisma as unknown as PrismaService & {
    lead: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
    leadActivity: { findMany: jest.Mock };
    task: { count: jest.Mock; findMany: jest.Mock };
    search: { count: jest.Mock };
    organization: { findUnique: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
};

describe('DashboardService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('summary applies period/source/owner filters and returns decision metrics', async () => {
    const prisma = makePrisma();
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.lead.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    prisma.task.count.mockResolvedValue(2);
    prisma.lead.findMany
      .mockResolvedValueOnce([
        { id: 'l1', companyName: 'A', nextContactAt: new Date('2020-01-01') },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'l2', companyName: 'B', score: 90, status: 'QUALIFIED', city: 'SP' },
      ]);
    prisma.lead.groupBy.mockResolvedValue([
      { source: 'GOOGLE_PLACES', status: 'WON', _count: 2 },
      { source: 'GOOGLE_PLACES', status: 'LOST', _count: 1 },
      { source: 'MANUAL', status: 'NEW', _count: 3 },
    ]);
    prisma.search.count.mockResolvedValue(2);
    prisma.organization.findUnique.mockResolvedValue({ plan: 'FREE', planStatus: 'INACTIVE' });
    const service = new DashboardService(prisma);

    const result = await service.summary('org-1', {
      period: '7d',
      source: 'GOOGLE_PLACES' as never,
      ownerId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.meetings).toBe(3);
    expect(result.proposals).toBe(2);
    expect(result.won).toBe(5);
    expect(result.lost).toBe(1);
    expect(result.conversionRate).toBe(83.3);
    expect(result.lossRate).toBe(16.7);
    expect(result.approachRate).toBe(80);
    expect(result.meetingRate).toBe(37.5);
    expect(result.overdueFollowUps).toHaveLength(1);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'HIGH_POTENTIAL_IDLE',
          count: 3,
          href: '/leads?status=QUALIFIED',
        }),
        expect.objectContaining({ code: 'STALE_LEADS', count: 2 }),
        expect.objectContaining({ code: 'OVERDUE_FOLLOW_UPS', count: 1 }),
        expect.objectContaining({ code: 'FREE_SEARCH_QUOTA', href: '/credits' }),
      ]),
    );
    expect(result.rates.period).toBe('7d');
    expect(result.overview).toBeUndefined();
    expect(result.conversionBySource).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'GOOGLE_PLACES',
          won: 2,
          lost: 1,
          conversionRate: 66.7,
        }),
      ]),
    );
  });

  it('overview builds UTC calendar days, compares adjacent creation cohorts, and scopes activity', async () => {
    const prisma = makePrisma();
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.leadActivity.findMany.mockResolvedValue([
      {
        id: 'activity-1',
        type: 'CALL',
        description: 'Called',
        outcome: 'No answer',
        createdAt: new Date('2026-10-20T08:00:00.000Z'),
        lead: { id: 'lead-1', companyName: 'Example' },
        user: { id: 'user-1', name: 'User' },
      },
    ]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Follow up',
        dueAt: new Date('2026-10-21T10:00:00.000Z'),
        lead: { id: 'lead-1', companyName: 'Example' },
      },
    ]);
    prisma.$queryRaw.mockResolvedValue(
      Array.from({ length: 30 }, (_, day) => {
        const date = new Date(Date.UTC(2026, 8, 21 + day));
        return { date, count: date.getUTCDate() === 20 ? 3n : 0n };
      }),
    );
    // Summary has stable production date bounds; freeze the clock for the UTC boundary assertions.
    jest.useFakeTimers().setSystemTime(new Date('2026-10-20T08:30:00.000Z'));
    const service = new DashboardService(prisma);

    try {
      const result = await service.summary('org-1', {
        period: '30d',
        source: 'GOOGLE_PLACES' as never,
        ownerId: '11111111-1111-1111-1111-111111111111',
        segment: 'Food',
      });

      expect(result.overview!.currentPeriod).toEqual({
        start: '2026-09-21T00:00:00.000Z',
        end: '2026-10-21T00:00:00.000Z',
      });
      expect(result.overview!.previousPeriod).toEqual({
        start: '2026-08-22T00:00:00.000Z',
        end: '2026-09-21T00:00:00.000Z',
      });
      expect(result.overview!.dailyCreated).toHaveLength(30);
      expect(result.overview!.dailyCreated.at(-1)).toEqual({ date: '2026-10-20', count: 3 });
      expect(result.overview!.dailyCreated[0]).toEqual({ date: '2026-09-21', count: 0 });
      const dailySql = prisma.$queryRaw.mock.calls[0][0].join(' ');
      expect(dailySql).toContain('lead."createdAt"::date = days.day');
      expect(dailySql).toContain('generate_series');
      expect(dailySql).toContain('COUNT(lead."id")');
      expect(result.overview!.kpis).toEqual({
        clients: { value: 10, previousValue: 5, changePercent: 100 },
        contacted: { value: 4, previousValue: 2, changePercent: 100 },
        qualified: { value: 3, previousValue: 1, changePercent: 200 },
        won: { value: 2, previousValue: 0, changePercent: null },
      });
      expect(result.overview!.recentActivity).toEqual([
        expect.objectContaining({
          id: 'activity-1',
          lead: { id: 'lead-1', companyName: 'Example' },
        }),
      ]);
      expect(result.overview!.nextActions).toEqual([
        expect.objectContaining({ id: 'task-1', lead: { id: 'lead-1', companyName: 'Example' } }),
      ]);
      const taskQuery = prisma.task.findMany.mock.calls[0][0];
      expect(taskQuery.where).toEqual({
        organizationId: 'org-1',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dueAt: { not: null },
        assigneeId: '11111111-1111-1111-1111-111111111111',
        AND: [
          {
            OR: [
              {
                lead: {
                  is: {
                    organizationId: 'org-1',
                    deletedAt: null,
                    source: 'GOOGLE_PLACES',
                    segment: { equals: 'Food', mode: 'insensitive' },
                  },
                },
              },
            ],
          },
        ],
      });
      expect(taskQuery.orderBy).toEqual({ dueAt: 'asc' });
      expect(taskQuery.take).toBe(5);
      const activityQuery = prisma.leadActivity.findMany.mock.calls[0][0];
      expect(activityQuery.where).toEqual({
        organizationId: 'org-1',
        lead: {
          organizationId: 'org-1',
          deletedAt: null,
          source: 'GOOGLE_PLACES',
          ownerId: '11111111-1111-1111-1111-111111111111',
          segment: { equals: 'Food', mode: 'insensitive' },
        },
      });
      expect(activityQuery.take).toBe(5);
    } finally {
      jest.useRealTimers();
    }
  });

  it('propagates overview query errors instead of returning partial metrics', async () => {
    const prisma = makePrisma();
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));
    const service = new DashboardService(prisma);

    await expect(service.summary('org-1', { period: '30d' })).rejects.toThrow(
      'database unavailable',
    );
  });

  it('returns empty overview values with null variation when the previous cohort is empty', async () => {
    const prisma = makePrisma();
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue(
      Array.from({ length: 30 }, (_, day) => ({
        date: new Date(Date.UTC(2026, 8, 21 + day)),
        count: 0n,
      })),
    );
    const service = new DashboardService(prisma);

    const result = await service.summary('org-1', { period: '30d' });

    expect(result.overview!.kpis).toEqual({
      clients: { value: 0, previousValue: 0, changePercent: null },
      contacted: { value: 0, previousValue: 0, changePercent: null },
      qualified: { value: 0, previousValue: 0, changePercent: null },
      won: { value: 0, previousValue: 0, changePercent: null },
    });
    expect(result.overview!.dailyCreated).toHaveLength(30);
    expect(result.overview!.dailyCreated.every((day) => day.count === 0)).toBe(true);
    expect(result.overview!.byStatus).toEqual([]);
    expect(result.overview!.nextActions).toEqual([]);
    expect(result.overview!.recentActivity).toEqual([]);
  });

  it('charts scopes groupBy by organization and optional filters', async () => {
    const prisma = makePrisma();
    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.lead.findMany.mockResolvedValue([
      {
        id: 'p1',
        companyName: 'Cafe SP',
        city: 'São Paulo',
        latitude: -23.55,
        longitude: -46.63,
        score: 88,
        status: 'QUALIFIED',
      },
    ]);
    prisma.$queryRaw.mockResolvedValue([]);
    const service = new DashboardService(prisma);

    const result = await service.charts('org-1', {
      period: '30d',
      ownerId: '11111111-1111-1111-1111-111111111111',
    });

    expect(prisma.lead.groupBy).toHaveBeenCalled();
    expect(prisma.lead.findMany).toHaveBeenCalled();
    expect(result.mapPins).toEqual([
      expect.objectContaining({
        id: 'p1',
        latitude: -23.55,
        longitude: -46.63,
        score: 88,
      }),
    ]);
  });
});
