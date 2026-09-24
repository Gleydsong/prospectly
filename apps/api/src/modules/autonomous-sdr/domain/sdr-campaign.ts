import { isAutonomyActionEnabled } from './autonomy-flags';
import { InvalidSdrCampaignError } from './sdr-errors';

export const SDR_OBJECTIVES = [
  'BOOK_MEETING',
  'GENERATE_REPLY',
  'QUALIFY_LEAD',
  'INTRODUCE_PRODUCT',
] as const;

export const SDR_AUTONOMY_LEVELS = ['MANUAL', 'ASSISTED', 'AUTONOMOUS'] as const;

export const SDR_CHANNELS = ['EMAIL', 'WHATSAPP'] as const;

export const SDR_CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'] as const;

export type SdrCampaignStatus = (typeof SDR_CAMPAIGN_STATUSES)[number];

export type SdrOutreachDecision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';

export type SdrObjective = (typeof SDR_OBJECTIVES)[number];
export type SdrAutonomyLevel = (typeof SDR_AUTONOMY_LEVELS)[number];
export type SdrChannel = (typeof SDR_CHANNELS)[number];

export type StructuredIcp = {
  industries: string[];
  geographies: string[];
  requiredSignals: string[];
  exclusions: string[];
};

export type SdrCampaignOffer = {
  name: string;
  description: string;
  valueProposition: string;
};

export type SdrCampaignLimits = {
  maxProspectsPerDay: number;
  maxMessagesPerDay: number;
  maxFollowUps: number;
};

export type SdrCampaign = {
  id: string;
  organizationId: string;
  ownerId: string;
  name: string;
  objective: SdrObjective;
  offer: SdrCampaignOffer;
  icp: StructuredIcp;
  channels: SdrChannel[];
  limits: SdrCampaignLimits;
  autonomyLevel: SdrAutonomyLevel;
  status: SdrCampaignStatus;
};

const OBJECTIVES = new Set<string>(SDR_OBJECTIVES);
const AUTONOMY = new Set<string>(SDR_AUTONOMY_LEVELS);
const CHANNELS = new Set<string>(SDR_CHANNELS);
const ICP_KEYS = new Set(['industries', 'geographies', 'requiredSignals', 'exclusions']);

function fail(message: string): never {
  throw new InvalidSdrCampaignError(message);
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(message);
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${field} is required`);
  return value.trim();
}

function stringList(value: unknown, field: string, allowEmpty: boolean): string[] {
  if (!Array.isArray(value)) fail(`${field} must be a list`);
  if (!allowEmpty && value.length === 0) fail(`${field} must not be empty`);
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.trim() === '') fail(`${field}[${index}] is required`);
    return item.trim();
  });
}

function parseIcp(value: unknown): StructuredIcp {
  const icp = asRecord(value, 'ICP must be structured criteria');
  for (const key of Object.keys(icp)) {
    if (!ICP_KEYS.has(key)) fail('ICP only accepts structured criteria');
  }
  return {
    industries: stringList(icp.industries, 'icp.industries', false),
    geographies: stringList(icp.geographies, 'icp.geographies', false),
    requiredSignals: stringList(icp.requiredSignals, 'icp.requiredSignals', false),
    exclusions: stringList(icp.exclusions, 'icp.exclusions', true),
  };
}

export function createSdrCampaign(input: unknown): SdrCampaign {
  const record = asRecord(input, 'Campaign must be an object');
  const channels = stringList(record.channels, 'channels', false);
  if (new Set(channels).size !== channels.length) fail('channels must be unique');
  if (!channels.every((channel) => CHANNELS.has(channel))) fail('channel is not allowed');

  const autonomyLevel = requiredText(record.autonomyLevel, 'autonomyLevel');
  if (!AUTONOMY.has(autonomyLevel)) fail('autonomyLevel is not allowed');
  if (channels.includes('WHATSAPP') && autonomyLevel === 'AUTONOMOUS') {
    fail('WhatsApp cannot be autonomous');
  }

  const objective = requiredText(record.objective, 'objective');
  if (!OBJECTIVES.has(objective)) fail('objective is not allowed');

  const offer = asRecord(record.offer, 'offer is required');
  const limits = asRecord(record.limits, 'limits are required');

  return {
    id: requiredText(record.id, 'id'),
    organizationId: requiredText(record.organizationId, 'organizationId'),
    ownerId: requiredText(record.ownerId, 'ownerId'),
    name: requiredText(record.name, 'name'),
    objective: objective as SdrObjective,
    offer: {
      name: requiredText(offer.name, 'offer.name'),
      description: requiredText(offer.description, 'offer.description'),
      valueProposition: requiredText(offer.valueProposition, 'offer.valueProposition'),
    },
    icp: parseIcp(record.icp),
    channels: channels as SdrChannel[],
    limits: {
      maxProspectsPerDay: positiveInt(limits.maxProspectsPerDay, 'limits.maxProspectsPerDay'),
      maxMessagesPerDay: positiveInt(limits.maxMessagesPerDay, 'limits.maxMessagesPerDay'),
      maxFollowUps: nonNegativeInt(limits.maxFollowUps, 'limits.maxFollowUps'),
    },
    autonomyLevel: autonomyLevel as SdrAutonomyLevel,
    status: 'DRAFT',
  };
}

function positiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail(`${field} must be a positive integer`);
  }
  return value;
}

function nonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`${field} must be a non-negative integer`);
  }
  return value;
}

const STATUSES = new Set<string>(SDR_CAMPAIGN_STATUSES);

const CAMPAIGN_TRANSITIONS: Readonly<Record<SdrCampaignStatus, readonly SdrCampaignStatus[]>> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['PAUSED', 'COMPLETED'],
  PAUSED: ['ACTIVE', 'COMPLETED'],
  COMPLETED: [],
};

export function assertSdrCampaignTransition(from: string, to: string): void {
  if (!STATUSES.has(from) || !STATUSES.has(to)) fail('campaign status is not allowed');
  const origin = from as SdrCampaignStatus;
  if (!CAMPAIGN_TRANSITIONS[origin].includes(to as SdrCampaignStatus)) {
    fail(`Campaign cannot move from ${from} to ${to}`);
  }
}

export function sdrCampaignOutreach(
  campaign: Pick<SdrCampaign, 'status' | 'channels' | 'autonomyLevel'>,
  flags: Parameters<typeof isAutonomyActionEnabled>[0],
): SdrOutreachDecision {
  if (campaign.status !== 'ACTIVE') return 'BLOCK';
  if (campaign.channels.includes('WHATSAPP')) return 'REQUIRE_APPROVAL';
  if (campaign.autonomyLevel !== 'AUTONOMOUS') return 'REQUIRE_APPROVAL';
  if (!isAutonomyActionEnabled(flags, 'autonomousSending')) return 'BLOCK';
  return 'ALLOW';
}
