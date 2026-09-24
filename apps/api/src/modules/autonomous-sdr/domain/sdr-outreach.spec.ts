import { defaultAutonomyFlags } from './autonomy-flags';
import { FakeOutreachProvider, OutreachGateway } from './sdr-outreach';

const campaign = {
  organizationId: 'org-a',
  status: 'ACTIVE' as const,
  channels: ['EMAIL' as const],
  autonomyLevel: 'AUTONOMOUS' as const,
  limits: { maxMessagesPerDay: 2 },
};

const message = {
  organizationId: 'org-a',
  messageId: 'msg-1',
  prospectId: 'prospect-1',
  status: 'READY' as const,
  body: 'O site da Oficina Alfa nao usa SSL.',
  to: 'fake-contact@example.test',
};

const allowed = {
  campaign,
  message,
  flags: { ...defaultAutonomyFlags(), autonomousSending: true },
  suppression: null,
  sentToday: 0,
  duplicate: false,
  hour: 10,
  workingHours: { start: 9, end: 18 },
};

describe('OutreachGateway', () => {
  it('sends once through the fake provider and publishes one outbox event', async () => {
    const provider = new FakeOutreachProvider();
    const gateway = new OutreachGateway(provider);

    const first = await gateway.execute(allowed);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await gateway.execute(allowed);
    }
    const published = gateway.publishPending();

    expect(provider.deliveries).toEqual([
      {
        organizationId: 'org-a',
        messageId: 'msg-1',
        to: 'fake-contact@example.test',
        body: 'O site da Oficina Alfa nao usa SSL.',
      },
    ]);
    expect(first).toMatchObject({ status: 'ACCEPTED', provider: 'fake' });
    expect(published).toEqual([
      {
        organizationId: 'org-a',
        type: 'prospect.contacted',
        messageId: 'msg-1',
        status: 'published',
      },
    ]);
    expect(gateway.list('org-b')).toEqual([]);
  });

  it('does not call the provider when policy blocks a paused campaign', async () => {
    const provider = new FakeOutreachProvider();
    const gateway = new OutreachGateway(provider);

    const result = await gateway.execute({
      ...allowed,
      campaign: { ...campaign, status: 'PAUSED' },
    });

    expect(result).toEqual({
      status: 'BLOCKED',
      provider: 'fake',
      action: 'BLOCK',
      reason: 'campaign_not_active',
    });
    expect(provider.deliveries).toEqual([]);
    expect(gateway.publishPending()).toEqual([]);
  });
});
