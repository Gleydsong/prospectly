import { defaultAutonomyFlags } from './autonomy-flags';
import { FakeOutreachProvider } from './sdr-outreach';
import { FollowUpScheduler } from './sdr-followups';

const due = {
  organizationId: 'org-a',
  prospectId: 'prospect-1',
  messageId: 'follow-1',
  campaignStatus: 'ACTIVE' as const,
  channels: ['EMAIL' as const],
  autonomyLevel: 'AUTONOMOUS' as const,
  sentToday: 0,
  duplicate: false,
  hour: 10,
  workingHours: { start: 9, end: 18 },
  originalDeliveryAccepted: true,
  replyExists: false,
  suppression: null,
  followUpsSent: 0,
  maxFollowUps: 2,
  earliestAt: '2026-09-24T00:00:00.000Z',
  now: '2026-09-26T00:00:00.000Z',
  providerHealthy: true,
  flags: { ...defaultAutonomyFlags(), autonomousFollowup: true, autonomousSending: true },
  to: 'fake-contact@example.test',
  body: 'Retomando o ponto do SSL.',
};

describe('FollowUpScheduler', () => {
  it('sends one follow-up after the interval and ignores repeated attempts', async () => {
    const provider = new FakeOutreachProvider();
    const scheduler = new FollowUpScheduler(provider);

    const first = await scheduler.run(due);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await scheduler.run(due);
    }

    expect(first).toEqual({ status: 'SENT' });
    expect(provider.deliveries).toHaveLength(1);
    expect(scheduler.list('org-b')).toEqual([]);
  });

  it('cancels when a reply or opt-out exists and does not send early or while the flag is off', async () => {
    const provider = new FakeOutreachProvider();
    const scheduler = new FollowUpScheduler(provider);

    expect(await scheduler.run({ ...due, messageId: 'follow-reply', replyExists: true })).toEqual({
      status: 'CANCELLED',
      reason: 'reply',
    });
    expect(
      await scheduler.run({ ...due, messageId: 'follow-stop', suppression: 'OPT_OUT' }),
    ).toEqual({ status: 'CANCELLED', reason: 'suppression' });
    expect(
      await scheduler.run({ ...due, messageId: 'follow-early', now: '2026-09-24T00:00:00.000Z' }),
    ).toEqual({ status: 'WAITING', reason: 'interval' });
    expect(
      await scheduler.run({
        ...due,
        messageId: 'follow-flag',
        flags: defaultAutonomyFlags(),
      }),
    ).toEqual({ status: 'BLOCKED', reason: 'feature_flag' });
    expect(provider.deliveries).toEqual([]);
  });

  it('does not send WhatsApp or assisted follow-ups even when the follow-up flag is on', async () => {
    const provider = new FakeOutreachProvider();
    const scheduler = new FollowUpScheduler(provider);

    await scheduler.run({ ...due, messageId: 'follow-wa', channels: ['WHATSAPP'] });
    await scheduler.run({ ...due, messageId: 'follow-assisted', autonomyLevel: 'ASSISTED' });

    expect(provider.deliveries).toEqual([]);
  });

  it('sends after the provider recovers because a blocked result is not cached', async () => {
    const provider = new FakeOutreachProvider();
    const scheduler = new FollowUpScheduler(provider);
    const input = { ...due, messageId: 'follow-retry' };

    expect(await scheduler.run({ ...input, providerHealthy: false })).toEqual({
      status: 'BLOCKED',
      reason: 'provider',
    });
    expect(await scheduler.run(input)).toEqual({ status: 'SENT' });
    expect(provider.deliveries).toHaveLength(1);
  });

  it('sends one follow-up when one hundred runs happen together', async () => {
    const provider = new FakeOutreachProvider();
    const original = provider.send.bind(provider);
    provider.send = async (delivery) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return original(delivery);
    };
    const scheduler = new FollowUpScheduler(provider);

    await Promise.all(Array.from({ length: 100 }, () => scheduler.run(due)));

    expect(provider.deliveries).toHaveLength(1);
  });
});
