import { isAutonomyActionEnabled, type SdrAutonomyFlagKey } from './autonomy-flags';
import {
  sdrCampaignOutreach,
  type SdrAutonomyLevel,
  type SdrCampaignStatus,
  type SdrChannel,
} from './sdr-campaign';

export const SUPPRESSION_REASONS = [
  'OPT_OUT',
  'UNSUBSCRIBE',
  'COMPLAINT',
  'USER_BLOCK',
  'LEGAL_RESTRICTION',
] as const;

export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export type PolicyAction = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';

export type PolicyDecision = {
  action: PolicyAction;
  reason: string;
};

type PolicyCampaign = {
  organizationId: string;
  status: SdrCampaignStatus;
  channels: SdrChannel[];
  autonomyLevel: SdrAutonomyLevel;
  limits: { maxMessagesPerDay: number };
};

export function authorizeSdrSend(input: {
  campaign: PolicyCampaign;
  message: { organizationId: string; status: 'READY' | 'BLOCK' };
  flags: Partial<Record<SdrAutonomyFlagKey, boolean>>;
  suppression: SuppressionReason | null;
  sentToday: number;
  duplicate: boolean;
  hour: number;
  workingHours: { start: number; end: number };
}): PolicyDecision {
  if (input.suppression) return { action: 'BLOCK', reason: 'suppression' };
  if (input.message.organizationId !== input.campaign.organizationId) {
    return { action: 'BLOCK', reason: 'tenant' };
  }
  if (input.message.status !== 'READY') return { action: 'BLOCK', reason: 'message_not_ready' };
  if (input.duplicate) return { action: 'BLOCK', reason: 'duplicate' };
  if (input.sentToday >= input.campaign.limits.maxMessagesPerDay) {
    return { action: 'BLOCK', reason: 'daily_limit' };
  }

  const campaignDecision = sdrCampaignOutreach(input.campaign, input.flags);
  if (campaignDecision === 'BLOCK') {
    if (input.campaign.status !== 'ACTIVE')
      return { action: 'BLOCK', reason: 'campaign_not_active' };
    if (!isAutonomyActionEnabled(input.flags, 'autonomousSending')) {
      return { action: 'BLOCK', reason: 'feature_flag' };
    }
    return { action: 'BLOCK', reason: 'campaign_blocked' };
  }
  if (campaignDecision === 'REQUIRE_APPROVAL') {
    return { action: 'REQUIRE_APPROVAL', reason: 'campaign_requires_approval' };
  }

  const inside = input.hour >= input.workingHours.start && input.hour < input.workingHours.end;
  if (!inside) return { action: 'REQUIRE_APPROVAL', reason: 'outside_working_hours' };
  return { action: 'ALLOW', reason: 'policy_allows' };
}
