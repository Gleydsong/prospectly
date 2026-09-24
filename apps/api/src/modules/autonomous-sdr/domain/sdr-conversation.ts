import { timingSafeEqual, createHash } from 'node:crypto';

import { assertProspectTransition, type ProspectState } from './prospect-state';
import { parseJevAnswer } from './sdr-decisions';
import type { SuppressionReason } from './sdr-policy';

const INTENTS = new Set([
  'INTERESTED',
  'MEETING_REQUEST',
  'QUESTION',
  'NOT_NOW',
  'NOT_INTERESTED',
  'OPT_OUT',
  'UNKNOWN',
]);

const OPT_OUT_TEXT = /\bstop\b/i;

type IntentChoice = {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

type StoredReply = {
  organizationId: string;
  prospectId: string;
  eventId: string;
  body: string;
  intent: string;
  state: ProspectState;
};

export type ReplyReceipt =
  | { status: 'ACCEPTED'; intent: string; state: ProspectState }
  | { status: 'REJECTED'; reason: 'unauthorized' | 'invalid_intent' | 'invalid_transition' };

function sameSecret(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function nextState(start: ProspectState, intent: string): ProspectState {
  assertProspectTransition(start, 'REPLIED');
  if (intent === 'INTERESTED' || intent === 'MEETING_REQUEST') {
    assertProspectTransition('REPLIED', 'INTERESTED');
  }
  if (intent === 'MEETING_REQUEST') {
    assertProspectTransition('INTERESTED', 'MEETING_REQUESTED');
    return 'MEETING_REQUESTED';
  }
  if (intent === 'NOT_NOW') {
    assertProspectTransition('REPLIED', 'NOT_NOW');
    return 'NOT_NOW';
  }
  if (intent === 'NOT_INTERESTED' || intent === 'OPT_OUT') {
    assertProspectTransition('REPLIED', 'NOT_INTERESTED');
    return 'NOT_INTERESTED';
  }
  if (intent === 'INTERESTED') return 'INTERESTED';
  return 'REPLIED';
}

export class ConversationInbox {
  private readonly replies: StoredReply[] = [];
  private readonly suppressed = new Map<string, SuppressionReason>();

  constructor(private readonly secret: string) {}

  receive(input: {
    organizationId: string;
    prospectId: string;
    eventId: string;
    secret: string;
    body: string;
    state: ProspectState;
    intent: IntentChoice;
  }): ReplyReceipt {
    if (!sameSecret(input.secret, this.secret))
      return { status: 'REJECTED', reason: 'unauthorized' };
    const key = `${input.organizationId}\u0000${input.eventId}`;
    const existing = this.replies.find(
      (reply) => `${reply.organizationId}\u0000${reply.eventId}` === key,
    );
    if (existing) return { status: 'ACCEPTED', intent: existing.intent, state: existing.state };

    const forcedOptOut = OPT_OUT_TEXT.test(input.body);
    let intent = 'UNKNOWN';
    if (!forcedOptOut) {
      try {
        const parsed = parseJevAnswer(input.intent);
        if (parsed.type !== 'choice' || !INTENTS.has(parsed.choice)) {
          return { status: 'REJECTED', reason: 'invalid_intent' };
        }
        intent = parsed.choice;
      } catch {
        return { status: 'REJECTED', reason: 'invalid_intent' };
      }
    } else {
      intent = 'OPT_OUT';
    }

    let state: ProspectState;
    try {
      state = nextState(input.state, intent);
    } catch {
      return { status: 'REJECTED', reason: 'invalid_transition' };
    }

    this.replies.push({
      organizationId: input.organizationId,
      prospectId: input.prospectId,
      eventId: input.eventId,
      body: input.body,
      intent,
      state,
    });
    if (intent === 'OPT_OUT') {
      this.suppressed.set(`${input.organizationId}\u0000${input.prospectId}`, 'OPT_OUT');
    }
    return { status: 'ACCEPTED', intent, state };
  }

  messages(organizationId: string): StoredReply[] {
    return this.replies.filter((reply) => reply.organizationId === organizationId);
  }

  suppression(organizationId: string, prospectId: string): SuppressionReason | null {
    return this.suppressed.get(`${organizationId}\u0000${prospectId}`) ?? null;
  }
}
