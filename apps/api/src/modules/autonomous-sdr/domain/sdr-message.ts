import type { ResearchBrief } from './sdr-research';

export const MESSAGE_STRATEGIES = [
  'website_problem',
  'growth_opportunity',
  'social_proof',
  'conversion_improvement',
  'local_market',
] as const;

export const MESSAGE_CTAS = [
  'quick_call',
  'audit_offer',
  'demo',
  'reply_only',
  'send_report',
] as const;

export const MESSAGE_TONES = ['direct', 'consultative', 'friendly', 'professional'] as const;

export type SdrMessage = {
  organizationId: string;
  prospectId: string;
  strategy: (typeof MESSAGE_STRATEGIES)[number];
  cta: (typeof MESSAGE_CTAS)[number];
  tone: (typeof MESSAGE_TONES)[number];
  body: string;
  citedEvidenceIds: string[];
};

export type MessageComposition =
  | { status: 'READY'; message: SdrMessage }
  | {
      status: 'BLOCK';
      message: null;
      reason: 'unsupported_claim' | 'generator_unavailable' | 'invalid_schema';
    };

export interface MessageGenerator {
  generate(input: unknown): Promise<unknown>;
}

const STRATEGIES = new Set<string>(MESSAGE_STRATEGIES);
const CTAS = new Set<string>(MESSAGE_CTAS);
const TONES = new Set<string>(MESSAGE_TONES);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function evidenceInBrief(brief: ResearchBrief): Set<string> {
  return new Set(brief.observations.flatMap((observation) => observation.evidenceIds));
}

function parseDraft(
  value: unknown,
  allowed: Set<string>,
): SdrMessage | 'invalid_schema' | 'unsupported_claim' {
  const record = asRecord(value);
  if (!record) return 'invalid_schema';
  if (typeof record.strategy !== 'string' || !STRATEGIES.has(record.strategy))
    return 'invalid_schema';
  if (typeof record.cta !== 'string' || !CTAS.has(record.cta)) return 'invalid_schema';
  if (typeof record.tone !== 'string' || !TONES.has(record.tone)) return 'invalid_schema';
  if (typeof record.body !== 'string' || record.body.trim() === '') return 'invalid_schema';
  if (!Array.isArray(record.citedEvidenceIds) || record.citedEvidenceIds.length === 0) {
    return 'unsupported_claim';
  }
  if (!record.citedEvidenceIds.every((id) => typeof id === 'string' && allowed.has(id))) {
    return 'unsupported_claim';
  }
  if (!Array.isArray(record.claims) || record.claims.length === 0) return 'unsupported_claim';
  for (const claim of record.claims) {
    const parsed = asRecord(claim);
    if (!parsed || typeof parsed.text !== 'string' || parsed.text.trim() === '')
      return 'invalid_schema';
    if (!Array.isArray(parsed.evidenceIds) || parsed.evidenceIds.length === 0)
      return 'unsupported_claim';
    if (!parsed.evidenceIds.every((id) => typeof id === 'string' && allowed.has(id))) {
      return 'unsupported_claim';
    }
  }
  return {
    organizationId: '',
    prospectId: '',
    strategy: record.strategy as SdrMessage['strategy'],
    cta: record.cta as SdrMessage['cta'],
    tone: record.tone as SdrMessage['tone'],
    body: record.body.trim(),
    citedEvidenceIds: record.citedEvidenceIds as string[],
  };
}

export async function composeSdrMessage(input: {
  brief: ResearchBrief;
  generator: MessageGenerator;
  untrustedText: string;
}): Promise<MessageComposition> {
  void input.untrustedText;
  let draft: unknown;
  try {
    draft = await input.generator.generate({
      organizationId: input.brief.organizationId,
      prospectId: input.brief.prospectId,
      angle: input.brief.angle,
    });
  } catch {
    return { status: 'BLOCK', message: null, reason: 'generator_unavailable' };
  }
  const parsed = parseDraft(draft, evidenceInBrief(input.brief));
  if (parsed === 'invalid_schema' || parsed === 'unsupported_claim') {
    return { status: 'BLOCK', message: null, reason: parsed };
  }
  return {
    status: 'READY',
    message: {
      ...parsed,
      organizationId: input.brief.organizationId,
      prospectId: input.brief.prospectId,
    },
  };
}
