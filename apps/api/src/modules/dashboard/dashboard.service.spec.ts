import type { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const makePrisma = () => {
  const prisma = {
    lead: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    task: { count: jest.fn() },
    search: { count: jest.fn() },
    organization: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  return prisma as unknown as PrismaService & {
    lead: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
    task: { count: jest.Mock };
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
    prisma.$transaction.mockResolvedValue([
      10, // total
      4, // new
      2, // qualified
      1, // contacted
      3, // meetings
      2, // proposals
      5, // won
      1, // lost
      2, // overdue tasks
      [{ id: 'l1', companyName: 'A', nextContactAt: new Date('2020-01-01') }],
      [],
      [{ id: 'l2', companyName: 'B', score: 90, status: 'QUALIFIED', city: 'SP' }],
      [
        { source: 'GOOGLE_PLACES', status: 'WON', _count: 2 },
        { source: 'GOOGLE_PLACES', status: 'LOST', _count: 1 },
        { source: 'MANUAL', status: 'NEW', _count: 3 },
      ],
      8, // approached
      3, // highPotentialIdle
      2, // staleLeads
      2, // searchCount
      { plan: 'FREE', planStatus: 'INACTIVE' },
    ]);
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
        expect.objectContaining({ code: 'HIGH_POTENTIAL_IDLE', count: 3, href: '/leads?status=QUALIFIED' }),
        expect.objectContaining({ code: 'STALE_LEADS', count: 2 }),
        expect.objectContaining({ code: 'OVERDUE_FOLLOW_UPS', count: 1 }),
        expect.objectContaining({ code: 'FREE_SEARCH_QUOTA', href: '/credits' }),
      ]),
    );
    expect(result.rates.period).toBe('7d');
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
    expect(prisma.$transaction).toHaveBeenCalled();
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
