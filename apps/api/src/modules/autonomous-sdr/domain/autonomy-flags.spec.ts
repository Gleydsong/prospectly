import { defaultAutonomyFlags, isAutonomyActionEnabled } from './autonomy-flags';

describe('defaultAutonomyFlags', () => {
  it('keeps every autonomous action off until an organization enables it', () => {
    expect(defaultAutonomyFlags()).toEqual({
      autonomousDiscovery: false,
      autonomousQualification: false,
      autonomousResearch: false,
      autonomousSending: false,
      autonomousFollowup: false,
      autonomousReply: false,
    });
  });
});

describe('isAutonomyActionEnabled', () => {
  it('fails closed when the flag is missing or unknown', () => {
    expect(isAutonomyActionEnabled({}, 'autonomousSending')).toBe(false);
    expect(isAutonomyActionEnabled({ autonomousSending: true }, 'not-a-flag')).toBe(false);
  });

  it('allows the action only when that flag is explicitly true', () => {
    expect(
      isAutonomyActionEnabled(
        { autonomousSending: true, autonomousReply: false },
        'autonomousSending',
      ),
    ).toBe(true);
    expect(
      isAutonomyActionEnabled(
        { autonomousSending: true, autonomousReply: false },
        'autonomousReply',
      ),
    ).toBe(false);
  });
});
