import { authorizeSdrSend, type PolicyDecision, type SuppressionReason } from './sdr-policy';
import type { SdrAutonomyLevel, SdrCampaignStatus, SdrChannel } from './sdr-campaign';
import type { SdrAutonomyFlagKey } from './autonomy-flags';

export type OutboundDelivery = {
  organizationId: string;
  messageId: string;
  to: string;
  body: string;
};

export type DeliveryReceipt = {
  status: 'ACCEPTED' | 'BLOCKED';
  provider: 'fake';
  action?: PolicyDecision['action'];
  reason?: string;
};

export interface OutreachProvider {
  send(delivery: OutboundDelivery): Promise<DeliveryReceipt>;
}

export class FakeOutreachProvider implements OutreachProvider {
  readonly deliveries: OutboundDelivery[] = [];

  async send(delivery: OutboundDelivery): Promise<DeliveryReceipt> {
    this.deliveries.push(delivery);
    return { status: 'ACCEPTED', provider: 'fake' };
  }
}

type OutboxEvent = {
  organizationId: string;
  type: 'prospect.contacted';
  messageId: string;
  status: 'pending' | 'published';
};

type SendInput = {
  campaign: {
    organizationId: string;
    status: SdrCampaignStatus;
    channels: SdrChannel[];
    autonomyLevel: SdrAutonomyLevel;
    limits: { maxMessagesPerDay: number };
  };
  message: OutboundDelivery & { status: 'READY' | 'BLOCK'; prospectId: string };
  flags: Partial<Record<SdrAutonomyFlagKey, boolean>>;
  suppression: SuppressionReason | null;
  sentToday: number;
  duplicate: boolean;
  hour: number;
  workingHours: { start: number; end: number };
};

export class OutreachGateway {
  private readonly sent = new Map<string, DeliveryReceipt>();
  private readonly outbox: OutboxEvent[] = [];

  constructor(private readonly provider: OutreachProvider) {}

  async execute(input: SendInput): Promise<DeliveryReceipt> {
    const key = `${input.message.organizationId}\u0000${input.message.messageId}`;
    const existing = this.sent.get(key);
    if (existing) return existing;

    const decision = authorizeSdrSend(input);
    if (decision.action !== 'ALLOW') {
      return {
        status: 'BLOCKED',
        provider: 'fake',
        action: decision.action,
        reason: decision.reason,
      };
    }

    const receipt = await this.provider.send({
      organizationId: input.message.organizationId,
      messageId: input.message.messageId,
      to: input.message.to,
      body: input.message.body,
    });
    this.sent.set(key, receipt);
    this.outbox.push({
      organizationId: input.message.organizationId,
      type: 'prospect.contacted',
      messageId: input.message.messageId,
      status: 'pending',
    });
    return receipt;
  }

  publishPending(): OutboxEvent[] {
    for (const event of this.outbox) {
      if (event.status === 'pending') event.status = 'published';
    }
    return this.outbox.filter((event) => event.status === 'published');
  }

  list(organizationId: string): OutboxEvent[] {
    return this.outbox.filter((event) => event.organizationId === organizationId);
  }
}
