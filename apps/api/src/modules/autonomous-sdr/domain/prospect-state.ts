import { InvalidProspectTransitionError } from './sdr-errors';

export const PROSPECT_STATES = [
  'DISCOVERED',
  'ENRICHED',
  'QUALIFIED',
  'RESEARCHED',
  'READY_FOR_OUTREACH',
  'CONTACTED',
  'FOLLOW_UP_PENDING',
  'REPLIED',
  'INTERESTED',
  'NOT_NOW',
  'NOT_INTERESTED',
  'NURTURE',
  'MEETING_REQUESTED',
  'MEETING_BOOKED',
  'CLOSED',
] as const;

export type ProspectState = (typeof PROSPECT_STATES)[number];

const STATES = new Set<string>(PROSPECT_STATES);

const TRANSITIONS: Readonly<Record<ProspectState, readonly ProspectState[]>> = {
  DISCOVERED: ['ENRICHED'],
  ENRICHED: ['QUALIFIED'],
  QUALIFIED: ['RESEARCHED'],
  RESEARCHED: ['READY_FOR_OUTREACH'],
  READY_FOR_OUTREACH: ['CONTACTED'],
  CONTACTED: ['FOLLOW_UP_PENDING', 'REPLIED'],
  FOLLOW_UP_PENDING: ['CONTACTED', 'REPLIED'],
  REPLIED: ['INTERESTED', 'NOT_NOW', 'NOT_INTERESTED', 'NURTURE'],
  INTERESTED: ['MEETING_REQUESTED'],
  NOT_NOW: ['NURTURE'],
  NOT_INTERESTED: [],
  NURTURE: ['READY_FOR_OUTREACH'],
  MEETING_REQUESTED: ['MEETING_BOOKED'],
  MEETING_BOOKED: ['CLOSED'],
  CLOSED: [],
};

export function isProspectState(value: string): value is ProspectState {
  return STATES.has(value);
}

export function assertProspectTransition(from: string, to: string): void {
  if (!isProspectState(from) || !isProspectState(to) || !TRANSITIONS[from].includes(to)) {
    throw new InvalidProspectTransitionError(from, to);
  }
}
