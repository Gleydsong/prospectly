import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { ReportsService } from './reports.service';

const NOW = new Date('2026-02-28T12:00:00.000Z');
const JAN_1 = new Date('2026-01-01T10:00:00.000Z');
const FEB_10 = new Date('2026-02-10T10:00:00.000Z');
const NINETY_ONE_DAYS_AGO = new Date(NOW.getTime() - 91 * 24 * 60 * 60 * 1000);

const WON_STAGE = 'stage-won';
const LOST_STAGE = 'stage-lost';
const OTHER_STAGE = 'stage-other';

const makePrisma = () => {
  const prisma = {
    pipelineStage: { findMany: jest.fn() },
    outboxEvent: { findMany: jest.fn() },
    lead: { findMany: jest.fn() },
  };
  return prisma as unknown as PrismaService & {
    pipelineStage: { findMany: jest.Mock };
    outboxEvent: { findMany: jest.Mock };
    lead: { findMany: jest.Mock };
  };
};

const RETAIN_UNTIL = new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000);

function createdEvent(leadId: string, at: Date, source = 'MANUAL') {
  return {
    type: 'lead.created',
    createdAt: at,
    retainUntil: RETAIN_UNTIL,
    payload: { leadId, source, ownerId: 'owner-1', stageId: null },
  };
}

function stageEvent(leadId: string, toStageId: string, at: Date) {
  return {
    type: 'lead.stage_changed',
    schemaVersion: 1,
    createdAt: at,
    retainUntil: RETAIN_UNTIL,
    payload: {
      leadId,
      fromStageId: OTHER_STAGE,
      toStageId,
      fromStageName: 'Proposta',
      toStageName: 'Ganho',
    },
  };
}

function stageEventV2(
  leadId: string,
  toStageId: string,
  at: Date,
  flags: { toStageIsWon: boolean; toStageIsLost: boolean },
) {
  return {
    type: 'lead.stage_changed',
    schemaVersion: 2,
    createdAt: at,
    retainUntil: RETAIN_UNTIL,
    payload: {
      leadId,
      fromStageId: OTHER_STAGE,
      toStageId,
      fromStageName: 'Proposta',
      toStageName: 'Ganho',
      ...flags,
    },
  };
}

describe('ReportsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects an unknown period instead of inventing all-time', async () => {
    const service = new ReportsService(makePrisma());
    await expect(
      service.funnelConversion('org-1', { period: 'all' as '7d' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts a January-created lead as a February win when it enters Ganho in February', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
      { id: LOST_STAGE, isWon: false, isLost: true },
    ]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      createdEvent('lead-jan', JAN_1),
      stageEvent('lead-jan', WON_STAGE, FEB_10),
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-jan', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false },
    ]);
    const service = new ReportsService(prisma);

    const result = await service.funnelConversion('org-1', { period: '30d' });

    expect(result.inflow).toBe(0);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBe(100);
    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          type: { in: ['lead.created', 'lead.stage_changed'] },
          retainUntil: { gte: NOW },
        }),
      }),
    );
  });

  it('counts a lead that enters Ganho twice in the window once', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
    ]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      stageEvent('lead-1', WON_STAGE, FEB_10),
      stageEvent('lead-1', WON_STAGE, new Date('2026-02-20T10:00:00.000Z')),
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', source: 'GOOGLE_PLACES', ownerId: 'owner-1', doNotContact: false },
    ]);
    const service = new ReportsService(prisma);

    const result = await service.funnelConversion('org-1', { period: '30d' });

    expect(result.wins).toBe(1);
  });

  it('ignores an event older than 90 days even on the longest window', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
    ]);
    prisma.outboxEvent.findMany.mockImplementation(async ({ where }: { where: { createdAt: { gte: Date } } }) => {
      const start = where.createdAt.gte;
      const events = [stageEvent('lead-old', WON_STAGE, NINETY_ONE_DAYS_AGO)];
      return events.filter((event) => event.createdAt >= start);
    });
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-old', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false },
    ]);
    const service = new ReportsService(prisma);

    const result = await service.funnelConversion('org-1', { period: '90d' });

    expect(result.wins).toBe(0);
  });

  it('uses distinct union for win rate when the same lead won then lost', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
      { id: LOST_STAGE, isWon: false, isLost: true },
    ]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      stageEvent('lead-both', WON_STAGE, FEB_10),
      {
        ...stageEvent('lead-both', LOST_STAGE, new Date('2026-02-12T10:00:00.000Z')),
        payload: {
          leadId: 'lead-both',
          fromStageId: WON_STAGE,
          toStageId: LOST_STAGE,
          fromStageName: 'Ganho',
          toStageName: 'Perdido',
        },
      },
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-both', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false },
    ]);
    const service = new ReportsService(prisma);

    const result = await service.funnelConversion('org-1', { period: '30d' });

    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
    expect(result.winRate).toBe(100);
  });

  it('skips events whose Lead is missing and still counts DNC wins', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
    ]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      stageEvent('gone', WON_STAGE, FEB_10),
      stageEvent('dnc', WON_STAGE, FEB_10),
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'dnc', source: 'CSV_IMPORT', ownerId: 'owner-1', doNotContact: true },
    ]);
    const service = new ReportsService(prisma);

    const result = await service.funnelConversion('org-1', { period: '30d' });

    expect(result.wins).toBe(1);
  });

  it('follows current funnel flags so reclassifying a stage rewrites the window', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findMany.mockResolvedValue([
      stageEvent('lead-1', OTHER_STAGE, FEB_10),
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false },
    ]);
    const service = new ReportsService(prisma);

    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: OTHER_STAGE, isWon: true, isLost: false },
    ]);
    await expect(service.funnelConversion('org-1', { period: '30d' })).resolves.toEqual(
      expect.objectContaining({ wins: 1 }),
    );

    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: OTHER_STAGE, isWon: false, isLost: false },
    ]);
    await expect(service.funnelConversion('org-1', { period: '30d' })).resolves.toEqual(
      expect.objectContaining({ wins: 0, winRate: 0 }),
    );
  });

  it('keeps a v2 win after the destination stage loses isWon', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findMany.mockResolvedValue([
      stageEventV2('lead-1', OTHER_STAGE, FEB_10, { toStageIsWon: true, toStageIsLost: false }),
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false },
    ]);
    const service = new ReportsService(prisma);

    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: OTHER_STAGE, isWon: false, isLost: false },
    ]);
    await expect(service.funnelConversion('org-1', { period: '30d' })).resolves.toEqual(
      expect.objectContaining({ wins: 1, losses: 0, winRate: 100 }),
    );
  });

  it('does not count a v2 event as a win from current flags when the snapshot was not won', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findMany.mockResolvedValue([
      stageEventV2('lead-1', WON_STAGE, FEB_10, { toStageIsWon: false, toStageIsLost: false }),
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false },
    ]);
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
    ]);
    const service = new ReportsService(prisma);

    await expect(service.funnelConversion('org-1', { period: '30d' })).resolves.toEqual(
      expect.objectContaining({ wins: 0, losses: 0, winRate: 0 }),
    );
  });

  it('breaks down by source and applies owner filter without using dashboard snapshot math', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
      { id: LOST_STAGE, isWon: false, isLost: true },
    ]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      createdEvent('mine', FEB_10, 'MANUAL'),
      createdEvent('theirs', FEB_10, 'GOOGLE_PLACES'),
      stageEvent('mine', WON_STAGE, FEB_10),
      {
        ...stageEvent('theirs', LOST_STAGE, FEB_10),
        payload: {
          leadId: 'theirs',
          fromStageId: OTHER_STAGE,
          toStageId: LOST_STAGE,
          fromStageName: 'Proposta',
          toStageName: 'Perdido',
        },
      },
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'mine', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false },
      { id: 'theirs', source: 'GOOGLE_PLACES', ownerId: 'owner-2', doNotContact: false },
    ]);
    const service = new ReportsService(prisma);

    const result = await service.funnelConversion('org-1', {
      period: '30d',
      ownerId: 'owner-1',
    });

    expect(result.inflow).toBe(1);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.bySource).toEqual([
      expect.objectContaining({ source: 'MANUAL', inflow: 1, wins: 1, losses: 0, winRate: 100 }),
    ]);
  });

  it('does not treat current Lead.status as a win without stage_changed in the window', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
    ]);
    prisma.outboxEvent.findMany.mockResolvedValue([createdEvent('lead-1', FEB_10)]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false, status: 'WON' },
    ]);
    const service = new ReportsService(prisma);

    const result = await service.funnelConversion('org-1', { period: '30d' });

    expect(result.inflow).toBe(1);
    expect(result.wins).toBe(0);
    expect(result.winRate).toBe(0);
  });

  it('ignores an event whose retainUntil has already passed', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
    ]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      { ...stageEvent('lead-1', WON_STAGE, FEB_10), retainUntil: new Date(NOW.getTime() - 1000) },
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false },
    ]);
    const service = new ReportsService(prisma);

    const result = await service.funnelConversion('org-1', { period: '30d' });

    expect(result.wins).toBe(0);
  });

  it('puts a January-created February win in the wins bucket, not inflow', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: WON_STAGE, isWon: true, isLost: false },
      { id: LOST_STAGE, isWon: false, isLost: true },
    ]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      createdEvent('lead-jan', JAN_1),
      stageEvent('lead-jan', WON_STAGE, FEB_10),
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-jan', source: 'MANUAL', ownerId: 'owner-1', doNotContact: false },
    ]);
    const service = new ReportsService(prisma);

    await expect(
      service.funnelConversionLeads('org-1', { period: '30d', bucket: 'wins' }),
    ).resolves.toEqual(
      expect.objectContaining({ bucket: 'wins', ids: ['lead-jan'], total: 1 }),
    );
    await expect(
      service.funnelConversionLeads('org-1', { period: '30d', bucket: 'inflow' }),
    ).resolves.toEqual(expect.objectContaining({ ids: [], total: 0 }));
  });

  it('rejects an unknown bucket instead of inventing a set', async () => {
    const service = new ReportsService(makePrisma());
    await expect(
      service.funnelConversionLeads('org-1', { period: '30d', bucket: 'rate' as 'wins' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an empty id list for an empty bucket', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findMany.mockResolvedValue([]);
    prisma.outboxEvent.findMany.mockResolvedValue([]);
    const service = new ReportsService(prisma);

    await expect(
      service.funnelConversionLeads('org-1', { period: '30d', bucket: 'losses' }),
    ).resolves.toEqual(expect.objectContaining({ ids: [], total: 0 }));
  });
});
