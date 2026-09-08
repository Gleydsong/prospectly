import { NotFoundException } from '@nestjs/common';

import { CommunicationsService } from './communications.service';

const ORG = 'org-1';
const LEAD = 'lead-1';
const CONN = 'conn-1';
const PAST = new Date('2026-08-01T10:00:00.000Z');
const NOW = new Date('2026-09-07T12:00:00.000Z');
const FUTURE = new Date('2026-10-01T10:00:00.000Z');
const OLDER_CONTACT = new Date('2026-07-01T00:00:00.000Z');

const makePrisma = () => ({
  lead: {
    findFirst: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  syncedCommunication: {
    create: jest.fn().mockResolvedValue({ id: 'sc-1' }),
    count: jest.fn().mockResolvedValue(1),
    findMany: jest.fn().mockResolvedValue([]),
  },
  leadActivity: { create: jest.fn() },
  outboxEvent: { create: jest.fn() },
});

const sample = {
  organizationId: ORG,
  leadId: LEAD,
  connectionId: CONN,
  externalId: 'msg-1',
  threadId: 'thread-1',
  occurredAt: PAST,
  direction: 'IN' as const,
  from: ['lead@acme.com'],
  to: ['ana@gmail.com'],
  cc: [],
  subject: 'Proposta',
  snippet: 'Segue a proposta',
  htmlLink: 'https://mail.google.com/mail/u/0/#all/thread-1',
  now: NOW,
};

describe('CommunicationsService', () => {
  it('persists metadata and advances lastContactAt to occurredAt when it is later and past', async () => {
    const prisma = makePrisma();
    const service = new CommunicationsService(prisma as never);
    await expect(service.persistEmail(sample)).resolves.toBe('created');
    expect(prisma.syncedCommunication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'EMAIL',
          externalId: 'msg-1',
          snippet: 'Segue a proposta',
          ingestedByConnectionId: CONN,
        }),
      }),
    );
    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: {
        id: LEAD,
        organizationId: ORG,
        deletedAt: null,
        OR: [{ lastContactAt: null }, { lastContactAt: { lt: PAST } }],
      },
      data: { lastContactAt: PAST },
    });
    expect(prisma.leadActivity.create).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('dedupes the same Google message id on the same Lead', async () => {
    const prisma = makePrisma();
    prisma.syncedCommunication.create.mockRejectedValue({ code: 'P2002' });
    const service = new CommunicationsService(prisma as never);
    await expect(service.persistEmail(sample)).resolves.toBe('duplicate');
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
  });

  it('does not write lastContactAt or nextContactAt for a future occurredAt', async () => {
    const prisma = makePrisma();
    const service = new CommunicationsService(prisma as never);
    await service.persistEmail({ ...sample, occurredAt: FUTURE });
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
  });

  it('lists emails for a readable lead including DNC and hides soft-deleted leads', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValueOnce({ id: LEAD }).mockResolvedValueOnce(null);
    prisma.syncedCommunication.findMany.mockResolvedValue([
      {
        id: 'sc-1',
        channel: 'EMAIL',
        externalId: 'msg-1',
        threadId: 'thread-1',
        occurredAt: PAST,
        direction: 'IN',
        fromAddresses: ['lead@acme.com'],
        toAddresses: ['ana@gmail.com'],
        ccAddresses: [],
        subject: 'Proposta',
        snippet: 'Segue',
        htmlLink: 'https://mail.google.com/mail/u/0/#all/thread-1',
      },
    ]);
    const service = new CommunicationsService(prisma as never);
    const listed = await service.listForLead(ORG, LEAD);
    expect(listed.data[0]?.snippet).toBe('Segue');
    await expect(service.listForLead(ORG, 'gone')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not stamp lastContactAt with now()', async () => {
    const prisma = makePrisma();
    const service = new CommunicationsService(prisma as never);
    await service.persistEmail({ ...sample, occurredAt: PAST });
    const data = prisma.lead.updateMany.mock.calls[0][0].data as { lastContactAt: Date };
    expect(data.lastContactAt).toEqual(PAST);
    expect(data.lastContactAt).not.toEqual(NOW);
    expect(data).not.toHaveProperty('nextContactAt');
    expect(OLDER_CONTACT.getTime()).toBeLessThan(PAST.getTime());
  });
});
