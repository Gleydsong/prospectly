import { defaultAutonomyFlags } from './autonomy-flags';
import { authorizeSdrSend } from './sdr-policy';

const campaign = {
  organizationId: 'org-a',
  status: 'ACTIVE' as const,
  channels: ['EMAIL' as const],
  autonomyLevel: 'AUTONOMOUS' as const,
  limits: { maxProspectsPerDay: 20, maxMessagesPerDay: 2, maxFollowUps: 3 },
};

const ready = {
  organizationId: 'org-a',
  status: 'READY' as const,
};

describe('authorizeSdrSend', () => {
  it('allows an active email campaign inside hours when the flag is on and the limit remains', () => {
    expect(
      authorizeSdrSend({
        campaign,
        message: ready,
        flags: { ...defaultAutonomyFlags(), autonomousSending: true },
        suppression: null,
        sentToday: 1,
        duplicate: false,
        hour: 10,
        workingHours: { start: 9, end: 18 },
      }),
    ).toEqual({ action: 'ALLOW', reason: 'policy_allows' });
  });

  it('blocks suppression, a paused campaign, the daily limit, and a duplicate before any send', () => {
    const flags = { ...defaultAutonomyFlags(), autonomousSending: true };
    const base = {
      campaign,
      message: ready,
      flags,
      sentToday: 0,
      duplicate: false,
      hour: 10,
      workingHours: { start: 9, end: 18 },
    };

    expect(authorizeSdrSend({ ...base, suppression: 'OPT_OUT' })).toEqual({
      action: 'BLOCK',
      reason: 'suppression',
    });
    expect(
      authorizeSdrSend({ ...base, suppression: null, campaign: { ...campaign, status: 'PAUSED' } }),
    ).toEqual({ action: 'BLOCK', reason: 'campaign_not_active' });
    expect(authorizeSdrSend({ ...base, suppression: null, sentToday: 2 })).toEqual({
      action: 'BLOCK',
      reason: 'daily_limit',
    });
    expect(authorizeSdrSend({ ...base, suppression: null, duplicate: true })).toEqual({
      action: 'BLOCK',
      reason: 'duplicate',
    });
  });

  it('requires approval outside working hours even when the campaign would otherwise allow', () => {
    expect(
      authorizeSdrSend({
        campaign,
        message: ready,
        flags: { ...defaultAutonomyFlags(), autonomousSending: true },
        suppression: null,
        sentToday: 0,
        duplicate: false,
        hour: 21,
        workingHours: { start: 9, end: 18 },
      }),
    ).toEqual({ action: 'REQUIRE_APPROVAL', reason: 'outside_working_hours' });
  });
});
