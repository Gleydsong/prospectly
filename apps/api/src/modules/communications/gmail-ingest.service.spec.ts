import { encryptRefreshToken } from '../google-connections/token-crypto';
import { GmailIngestService } from './gmail-ingest.service';

const KEY = 'aa'.repeat(32);
const NOW = new Date('2026-09-07T12:00:00.000Z');
const PAST = new Date('2026-08-20T09:00:00.000Z');

const connection = {
  id: 'conn-1',
  organizationId: 'org-1',
  googleEmail: 'ana@gmail.com',
  refreshTokenEncrypted: encryptRefreshToken('refresh-plain', KEY),
  revokedAt: null,
  lastSyncAt: null,
};

describe('GmailIngestService', () => {
  const makeDeps = () => {
    const persistEmail = jest.fn().mockResolvedValue('created');
    const prisma = {
      googleConnection: {
        findFirst: jest.fn().mockResolvedValue(connection),
        findMany: jest.fn().mockResolvedValue([connection]),
        update: jest.fn().mockResolvedValue({}),
      },
      lead: {
        findMany: jest.fn().mockResolvedValue([{ id: 'lead-1', email: 'lead@acme.com' }]),
      },
      leadContact: { findMany: jest.fn().mockResolvedValue([]) },
      leadActivity: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    const gmail = {
      refreshAccessToken: jest.fn().mockResolvedValue('access'),
      listMessages: jest.fn().mockResolvedValue([
        {
          externalId: 'msg-1',
          threadId: 'thread-1',
          occurredAt: PAST,
          from: ['lead@acme.com'],
          to: ['ana@gmail.com'],
          cc: ['cc@acme.com'],
          subject: 'Oi',
          snippet: 'texto',
          htmlLink: 'https://mail.google.com/mail/u/0/#all/thread-1',
        },
      ]),
    };
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new GmailIngestService(
      prisma as never,
      { get: () => KEY } as never,
      { persistEmail } as never,
      gmail as never,
      queue as never,
    );
    return { service, prisma, gmail, persistEmail, queue };
  };

  it('matches from/to/cc, persists once, and skips BCC-only addresses', async () => {
    const { service, persistEmail, gmail, prisma } = makeDeps();
    await service.syncConnection('org-1', 'conn-1', NOW);
    expect(gmail.refreshAccessToken).toHaveBeenCalled();
    expect(persistEmail).toHaveBeenCalledTimes(1);
    expect(persistEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        externalId: 'msg-1',
        direction: 'IN',
        now: NOW,
      }),
    );
    expect(JSON.stringify(gmail.listMessages.mock.calls)).not.toContain('bcc');
    expect(prisma.leadActivity.create).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    expect(prisma.googleConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastSyncAt: NOW, lastError: null }),
      }),
    );
  });

  it('discards unmatched and colliding contact emails', async () => {
    const { service, persistEmail, prisma } = makeDeps();
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.leadContact.findMany.mockResolvedValue([
      { email: 'shared@acme.com', leadId: 'lead-a' },
      { email: 'shared@acme.com', leadId: 'lead-b' },
    ]);
    persistEmail.mockClear();
    await service.syncConnection('org-1', 'conn-1', NOW);
    expect(persistEmail).not.toHaveBeenCalled();
  });

  it('two ingestions of the same message still call persist (dedupe is the persist seam)', async () => {
    const { service, persistEmail } = makeDeps();
    persistEmail.mockResolvedValueOnce('created').mockResolvedValueOnce('duplicate');
    await service.syncConnection('org-1', 'conn-1', NOW);
    await service.syncConnection('org-1', 'conn-1', NOW);
    expect(persistEmail).toHaveBeenCalledTimes(2);
    expect(persistEmail.mock.calls[0][0].externalId).toBe('msg-1');
    expect(persistEmail.mock.calls[1][0].externalId).toBe('msg-1');
  });

  it('enqueues connection ids only, never snippet', async () => {
    const { service, queue } = makeDeps();
    await service.enqueueConnection('org-1', 'conn-1', 'corr-1');
    expect(queue.add).toHaveBeenCalledWith(
      'sync-gmail-connection',
      { organizationId: 'org-1', connectionId: 'conn-1', correlationId: 'corr-1' },
      expect.objectContaining({ jobId: 'gmail-sync-conn-1' }),
    );
    expect(JSON.stringify(queue.add.mock.calls[0][1])).not.toContain('texto');
    expect(JSON.stringify(queue.add.mock.calls[0][1])).not.toContain('Oi');
  });

  it('still matches DNC leads (doNotContact is not queried)', async () => {
    const { service, persistEmail, prisma } = makeDeps();
    prisma.lead.findMany.mockResolvedValue([{ id: 'lead-dnc', email: 'lead@acme.com' }]);
    await service.syncConnection('org-1', 'conn-1', NOW);
    expect(prisma.lead.findMany.mock.calls[0][0].where).not.toHaveProperty('doNotContact');
    expect(persistEmail).toHaveBeenCalledWith(expect.objectContaining({ leadId: 'lead-dnc' }));
  });
});
