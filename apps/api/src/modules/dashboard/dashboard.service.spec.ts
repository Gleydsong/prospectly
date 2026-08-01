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
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  return prisma as unknown as PrismaService & {
    lead: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
    task: { count: jest.Mock };
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
    expect(result.overdueFollowUps).toHaveLength(1);
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
    prisma.$queryRaw.mockResolvedValue([]);
    const service = new DashboardService(prisma);

    await service.charts('org-1', { period: '30d', ownerId: '11111111-1111-1111-1111-111111111111' });

    expect(prisma.lead.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          deletedAt: null,
          ownerId: '11111111-1111-1111-1111-111111111111',
        }),
      }),
    );
  });
});
