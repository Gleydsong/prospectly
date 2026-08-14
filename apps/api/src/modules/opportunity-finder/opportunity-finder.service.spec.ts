import { NotFoundException } from '@nestjs/common';

import { OpportunityFinderService } from './opportunity-finder.service';

describe('OpportunityFinderService tenant isolation', () => {
  const prisma = {
    opportunityRun: { findFirst: jest.fn() },
    opportunityCandidate: { findMany: jest.fn(), count: jest.fn() },
  };
  const service = new OpportunityFinderService(
    prisma as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('does not reveal runs belonging to another organization', async () => {
    prisma.opportunityRun.findFirst.mockResolvedValue(null);
    await expect(service.get('org-b', 'run-from-org-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.opportunityRun.findFirst).toHaveBeenCalledWith({
      where: { id: 'run-from-org-a', organizationId: 'org-b' },
    });
  });

  it('checks the run tenant before listing candidate data', async () => {
    prisma.opportunityRun.findFirst.mockResolvedValue(null);
    await expect(service.listCandidates('org-b', 'run-from-org-a', { pageSize: 20 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.opportunityCandidate.findMany).not.toHaveBeenCalled();
  });

  it('uses the tenant idempotency constraint for double submissions', async () => {
    const now = new Date('2026-08-12T10:00:00.000Z');
    const existingRun = {
      id: 'run-1', status: 'PREPARING', service: 'Criação de sites', city: 'Curitiba',
      state: 'PR', country: 'BR', profile: null, searchStrategy: null,
      scoringVersion: 'opportunity-score-v1', candidateCount: 0, analyzedCount: 0,
      failedCount: 0, errorCode: null, errorMessage: null, startedAt: now,
      completedAt: null, createdAt: now,
    };
    const persistence = {
      opportunityRun: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existingRun),
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
    };
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const billing = {
      assertCanCreateSearch: jest.fn().mockResolvedValue(undefined),
      consumeCreditForOpportunityRun: jest.fn().mockResolvedValue(undefined),
      refundOpportunityRunCredit: jest.fn().mockResolvedValue(undefined),
      consumeCreditForExplain: jest.fn().mockResolvedValue(undefined),
      consumeCreditForSaveLead: jest.fn().mockResolvedValue(undefined),
      refundExplainCredit: jest.fn().mockResolvedValue(undefined),
      refundSaveLeadCredit: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const idempotentService = new OpportunityFinderService(
      persistence as never,
      queue as never,
      { list: () => [{ available: true }] } as never,
      {} as never,
      {} as never,
      billing as never,
      {} as never,
      {} as never,
      audit as never,
    );

    await expect(idempotentService.create('org-1', 'user-1', {
      service: 'Criação de sites', city: 'Curitiba', state: 'PR', country: 'BR',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })).resolves.toMatchObject({ id: 'run-1' });
    expect(persistence.opportunityRun.create).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(billing.consumeCreditForOpportunityRun).not.toHaveBeenCalled();
    expect(billing.assertCanCreateSearch).toHaveBeenCalledWith('org-1', 16);
  });
});
