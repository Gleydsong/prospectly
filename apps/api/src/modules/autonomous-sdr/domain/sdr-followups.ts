import { isAutonomyActionEnabled, type SdrAutonomyFlagKey } from './autonomy-flags';
import type { OutreachProvider } from './sdr-outreach';
import type { SuppressionReason } from './sdr-policy';

export type FollowUpResult =
  | { status: 'SENT' }
  | { status: 'CANCELLED'; reason: 'reply' | 'suppression' }
  | { status: 'WAITING'; reason: 'interval' }
  | { status: 'BLOCKED'; reason: 'feature_flag' | 'campaign' | 'delivery' | 'limit' | 'provider' };

type FollowUpInput = {
  organizationId: string;
  prospectId: string;
  messageId: string;
  campaignStatus: 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'COMPLETED';
  originalDeliveryAccepted: boolean;
  replyExists: boolean;
  suppression: SuppressionReason | null;
  followUpsSent: number;
  maxFollowUps: number;
  earliestAt: string;
  now: string;
  providerHealthy: boolean;
  flags: Partial<Record<SdrAutonomyFlagKey, boolean>>;
  to: string;
  body: string;
};

type SentFollowUp = {
  organizationId: string;
  messageId: string;
};

export class FollowUpScheduler {
  private readonly sent = new Map<string, FollowUpResult>();
  private readonly records: SentFollowUp[] = [];

  constructor(private readonly provider: OutreachProvider) {}

  async run(input: FollowUpInput): Promise<FollowUpResult> {
    const key = `${input.organizationId}\u0000${input.messageId}`;
    const existing = this.sent.get(key);
    if (existing) return existing;

    const decision = this.decide(input);
    if (decision.status === 'WAITING') return decision;
    if (decision.status === 'SENT') {
      await this.provider.send({
        organizationId: input.organizationId,
        messageId: input.messageId,
        to: input.to,
        body: input.body,
      });
      this.records.push({ organizationId: input.organizationId, messageId: input.messageId });
    }
    this.sent.set(key, decision);
    return decision;
  }

  list(organizationId: string): SentFollowUp[] {
    return this.records.filter((record) => record.organizationId === organizationId);
  }

  private decide(input: FollowUpInput): FollowUpResult {
    if (input.replyExists) return { status: 'CANCELLED', reason: 'reply' };
    if (input.suppression) return { status: 'CANCELLED', reason: 'suppression' };
    if (!isAutonomyActionEnabled(input.flags, 'autonomousFollowup')) {
      return { status: 'BLOCKED', reason: 'feature_flag' };
    }
    if (input.campaignStatus !== 'ACTIVE') return { status: 'BLOCKED', reason: 'campaign' };
    if (!input.originalDeliveryAccepted) return { status: 'BLOCKED', reason: 'delivery' };
    if (Date.parse(input.now) <= Date.parse(input.earliestAt)) {
      return { status: 'WAITING', reason: 'interval' };
    }
    if (input.followUpsSent >= input.maxFollowUps) return { status: 'BLOCKED', reason: 'limit' };
    if (!input.providerHealthy) return { status: 'BLOCKED', reason: 'provider' };
    return { status: 'SENT' };
  }
}
