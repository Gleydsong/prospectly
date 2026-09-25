import { isAutonomyActionEnabled, type SdrAutonomyFlagKey } from './autonomy-flags';
import type { SdrAutonomyLevel, SdrChannel } from './sdr-campaign';
import type { OutreachProvider } from './sdr-outreach';
import { authorizeSdrSend, type SuppressionReason } from './sdr-policy';

export type FollowUpResult =
  | { status: 'SENT' }
  | { status: 'CANCELLED'; reason: 'reply' | 'suppression' }
  | { status: 'WAITING'; reason: 'interval' }
  | { status: 'BLOCKED'; reason: 'feature_flag' | 'campaign' | 'delivery' | 'limit' | 'provider' | 'policy' };

type FollowUpInput = {
  organizationId: string;
  prospectId: string;
  messageId: string;
  campaignStatus: 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'COMPLETED';
  channels: SdrChannel[];
  autonomyLevel: SdrAutonomyLevel;
  sentToday: number;
  duplicate: boolean;
  hour: number;
  workingHours: { start: number; end: number };
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
  private readonly inflight = new Map<string, Promise<FollowUpResult>>();
  private readonly records: SentFollowUp[] = [];

  constructor(private readonly provider: OutreachProvider) {}

  run(input: FollowUpInput): Promise<FollowUpResult> {
    const key = `${input.organizationId}\u0000${input.messageId}`;
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const decision = this.decide(input);
    if (decision.status !== 'SENT' && decision.status !== 'CANCELLED') return Promise.resolve(decision);

    const run = this.finish(input, key, decision);
    this.inflight.set(key, run);
    return run;
  }

  list(organizationId: string): SentFollowUp[] {
    return this.records.filter((record) => record.organizationId === organizationId);
  }

  private async finish(
    input: FollowUpInput,
    key: string,
    decision: FollowUpResult,
  ): Promise<FollowUpResult> {
    try {
      if (decision.status === 'SENT') {
        await this.provider.send({
          organizationId: input.organizationId,
          messageId: input.messageId,
          to: input.to,
          body: input.body,
        });
        this.records.push({ organizationId: input.organizationId, messageId: input.messageId });
      }
      return decision;
    } catch (error) {
      this.inflight.delete(key);
      throw error;
    }
  }

  private decide(input: FollowUpInput): FollowUpResult {
    if (input.replyExists) return { status: 'CANCELLED', reason: 'reply' };
    if (input.suppression) return { status: 'CANCELLED', reason: 'suppression' };
    if (!isAutonomyActionEnabled(input.flags, 'autonomousFollowup')) {
      return { status: 'BLOCKED', reason: 'feature_flag' };
    }
    if (!input.originalDeliveryAccepted) return { status: 'BLOCKED', reason: 'delivery' };
    if (Date.parse(input.now) <= Date.parse(input.earliestAt)) {
      return { status: 'WAITING', reason: 'interval' };
    }
    if (input.followUpsSent >= input.maxFollowUps) return { status: 'BLOCKED', reason: 'limit' };
    if (!input.providerHealthy) return { status: 'BLOCKED', reason: 'provider' };

    const policy = authorizeSdrSend({
      campaign: {
        organizationId: input.organizationId,
        status: input.campaignStatus,
        channels: input.channels,
        autonomyLevel: input.autonomyLevel,
        limits: { maxMessagesPerDay: input.maxFollowUps },
      },
      message: { organizationId: input.organizationId, status: 'READY' },
      flags: input.flags,
      suppression: input.suppression,
      sentToday: input.sentToday,
      duplicate: input.duplicate,
      hour: input.hour,
      workingHours: input.workingHours,
    });
    if (policy.action !== 'ALLOW') return { status: 'BLOCKED', reason: 'policy' };
    return { status: 'SENT' };
  }
}
