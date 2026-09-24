import { InvalidProspectTransitionError } from './sdr-errors';
import { assertProspectTransition } from './prospect-state';

describe('assertProspectTransition', () => {
  it('allows the qualification path and blocks a skip to outreach', () => {
    expect(() => assertProspectTransition('DISCOVERED', 'ENRICHED')).not.toThrow();
    expect(() => assertProspectTransition('ENRICHED', 'QUALIFIED')).not.toThrow();
    expect(() => assertProspectTransition('QUALIFIED', 'RESEARCHED')).not.toThrow();
    expect(() => assertProspectTransition('RESEARCHED', 'READY_FOR_OUTREACH')).not.toThrow();
    expect(() => assertProspectTransition('READY_FOR_OUTREACH', 'CONTACTED')).not.toThrow();

    expect(() => assertProspectTransition('DISCOVERED', 'CONTACTED')).toThrow(
      InvalidProspectTransitionError,
    );
    expect(() => assertProspectTransition('ENRICHED', 'READY_FOR_OUTREACH')).toThrow(
      InvalidProspectTransitionError,
    );
  });

  it('allows reply intents and blocks contact after close or opt-out terminal', () => {
    expect(() => assertProspectTransition('CONTACTED', 'REPLIED')).not.toThrow();
    expect(() => assertProspectTransition('REPLIED', 'INTERESTED')).not.toThrow();
    expect(() => assertProspectTransition('REPLIED', 'NOT_INTERESTED')).not.toThrow();
    expect(() => assertProspectTransition('INTERESTED', 'MEETING_REQUESTED')).not.toThrow();
    expect(() => assertProspectTransition('MEETING_REQUESTED', 'MEETING_BOOKED')).not.toThrow();
    expect(() => assertProspectTransition('MEETING_BOOKED', 'CLOSED')).not.toThrow();

    expect(() => assertProspectTransition('CLOSED', 'CONTACTED')).toThrow(
      InvalidProspectTransitionError,
    );
    expect(() => assertProspectTransition('NOT_INTERESTED', 'READY_FOR_OUTREACH')).toThrow(
      InvalidProspectTransitionError,
    );
  });

  it('allows follow-up and nurture only on their explicit edges', () => {
    expect(() => assertProspectTransition('CONTACTED', 'FOLLOW_UP_PENDING')).not.toThrow();
    expect(() => assertProspectTransition('FOLLOW_UP_PENDING', 'CONTACTED')).not.toThrow();
    expect(() => assertProspectTransition('FOLLOW_UP_PENDING', 'REPLIED')).not.toThrow();
    expect(() => assertProspectTransition('REPLIED', 'NOT_NOW')).not.toThrow();
    expect(() => assertProspectTransition('REPLIED', 'NURTURE')).not.toThrow();
    expect(() => assertProspectTransition('NOT_NOW', 'NURTURE')).not.toThrow();
    expect(() => assertProspectTransition('NURTURE', 'READY_FOR_OUTREACH')).not.toThrow();

    expect(() => assertProspectTransition('FOLLOW_UP_PENDING', 'MEETING_BOOKED')).toThrow(
      InvalidProspectTransitionError,
    );
    expect(() => assertProspectTransition('NURTURE', 'CONTACTED')).toThrow(
      InvalidProspectTransitionError,
    );
  });

  it('rejects an unknown state instead of treating it as allowed', () => {
    expect(() => assertProspectTransition('DISCOVERED', 'HOT')).toThrow(
      InvalidProspectTransitionError,
    );
  });
});
