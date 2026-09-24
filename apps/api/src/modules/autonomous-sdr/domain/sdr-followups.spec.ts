import { defaultAutonomyFlags } from './autonomy-flags';
import { FakeOutreachProvider } from './sdr-outreach';
import { FollowUpScheduler } from './sdr-followups';

const due = {
  organizationId: 'org-a',
  prospectId: 'prospect-1',
  messageId: 'follow-1',
  campaignStatus: 'ACTIVE' as const,
  originalDeliveryAccepted: true,
  replyExists: false,
  suppression: null,
  followUpsSent: 0,
  maxFollowUps: 2,
  earliestAt: '2026-09-24T00:00:00.000Z',
  now: '2026-09-26T00:00:00.000Z',
  providerHealthy: true,
  flags: { ...defaultAutonomyFlags(), autonomousFollowup: true },
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
});
