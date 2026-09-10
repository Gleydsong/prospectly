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
  googleConnection: { findFirst: jest.fn(), findUnique: jest.fn() },
  leadActivity: { create: jest.fn() },
  outboxEvent: { create: jest.fn() },
  task: { create: jest.fn() },
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

  it('persists a past calendar event and advances lastContactAt without nextContactAt or Task', async () => {
    const prisma = makePrisma();
    const service = new CommunicationsService(prisma as never);
    await expect(
      service.persistEvent({
        organizationId: ORG,
        leadId: LEAD,
        connectionId: CONN,
        externalId: 'evt-1',
        occurredAt: PAST,
        from: ['ana@gmail.com'],
        to: ['lead@acme.com'],
        cc: [],
        subject: 'Kickoff',
        snippet: 'Sala 2',
        htmlLink: 'https://www.google.com/calendar/event?eid=evt-1',
        now: NOW,
      }),
    ).resolves.toBe('created');
    expect(prisma.syncedCommunication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'CALENDAR',
          direction: 'EVENT',
          externalId: 'evt-1',
          threadId: null,
        }),
      }),
    );
    expect(prisma.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lastContactAt: PAST },
      }),
    );
    expect(prisma.lead.updateMany.mock.calls[0][0].data).not.toHaveProperty('nextContactAt');
    expect(prisma.leadActivity.create).not.toHaveBeenCalled();
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('shows a future calendar event without writing lastContactAt or nextContactAt', async () => {
    const prisma = makePrisma();
    const service = new CommunicationsService(prisma as never);
    await service.persistEvent({
      organizationId: ORG,
      leadId: LEAD,
      connectionId: CONN,
      externalId: 'evt-future',
      occurredAt: FUTURE,
      from: ['ana@gmail.com'],
      to: ['lead@acme.com'],
      cc: [],
      subject: 'Demo',
      snippet: '',
      htmlLink: 'https://www.google.com/calendar/event?eid=evt-future',
      now: NOW,
    });
    expect(prisma.syncedCommunication.create).toHaveBeenCalled();
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
  });

  it('dedupes the same Google event id on the same Lead', async () => {
    const prisma = makePrisma();
    prisma.syncedCommunication.create.mockRejectedValue({ code: 'P2002' });
    const service = new CommunicationsService(prisma as never);
    await expect(
      service.persistEvent({
        organizationId: ORG,
        leadId: LEAD,
        connectionId: CONN,
        externalId: 'evt-1',
        occurredAt: PAST,
        from: ['ana@gmail.com'],
        to: ['lead@acme.com'],
        cc: [],
        subject: 'Kickoff',
        snippet: '',
        htmlLink: 'https://www.google.com/calendar/event?eid=evt-1',
        now: NOW,
      }),
    ).resolves.toBe('duplicate');
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
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

  it('lists emails and calendar events for a readable lead including DNC and hides soft-deleted leads', async () => {
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
    expect(prisma.syncedCommunication.count.mock.calls[0][0].where).toEqual({
      organizationId: ORG,
      leadId: LEAD,
    });
    await expect(service.listForLead(ORG, 'gone')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: { id: LEAD, organizationId: ORG, deletedAt: null },
      select: { id: true },
    });
    expect(prisma.googleConnection.findFirst).not.toHaveBeenCalled();
    expect(prisma.googleConnection.findUnique).not.toHaveBeenCalled();
  });

  it('lists casamentos after the colleague disconnected — visibility is the Lead ACL', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: LEAD });
    prisma.syncedCommunication.count.mockResolvedValue(1);
    prisma.syncedCommunication.findMany.mockResolvedValue([
      {
        id: 'sc-kept',
        channel: 'EMAIL',
        externalId: 'msg-kept',
        threadId: 'thread-kept',
        occurredAt: PAST,
        direction: 'IN',
        fromAddresses: ['lead@acme.com'],
        toAddresses: ['ana@gmail.com'],
        ccAddresses: [],
        subject: 'Ainda visível',
        snippet: 'histórico da equipa',
        htmlLink: 'https://mail.google.com/mail/u/0/#all/thread-kept',
      },
    ]);
    const service = new CommunicationsService(prisma as never);
    const listed = await service.listForLead(ORG, LEAD);
    expect(listed.data).toHaveLength(1);
    expect(listed.data[0]?.snippet).toBe('histórico da equipa');
    expect(prisma.googleConnection.findFirst).not.toHaveBeenCalled();
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
