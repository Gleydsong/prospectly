import { OrganizationEvidenceLedger } from './sdr-evidence';
import { InvalidSdrResearchError } from './sdr-errors';

const ANGLES = new Set([
  'website_problem',
  'growth_opportunity',
  'social_proof',
  'conversion_improvement',
  'local_market',
]);

export type ResearchObservation = {
  statement: string;
  evidenceIds: string[];
};

export type ResearchBrief = {
  organizationId: string;
  prospectId: string;
  angle: string;
  observations: ResearchObservation[];
  hooks: string[];
};

export type ResearchInput = {
  qualification: 'QUALIFIED' | 'REJECTED' | 'REVIEW';
  organizationId: string;
  prospectId: string;
  ledger: OrganizationEvidenceLedger;
  evidenceIds: readonly string[];
  angle: string;
  untrustedText: string;
  at: Date;
};

export function researchQualifiedProspect(input: ResearchInput): ResearchBrief {
  if (input.qualification !== 'QUALIFIED') {
    throw new InvalidSdrResearchError('research requires a qualified prospect');
  }
  if (!ANGLES.has(input.angle)) throw new InvalidSdrResearchError('angle is not allowed');
  void input.untrustedText;
  if (
    input.ledger.assess(input.organizationId, input.prospectId, input.evidenceIds, input.at) !==
    'SUPPORTED'
  ) {
    throw new InvalidSdrResearchError('research requires live evidence');
  }

  const observations: ResearchObservation[] = [];
  const hooks: string[] = [];
  for (const evidenceId of input.evidenceIds) {
    const evidence = input.ledger.read(input.organizationId, evidenceId);
    if (!evidence || evidence.prospectId !== input.prospectId) {
      throw new InvalidSdrResearchError('research requires live evidence');
    }
    observations.push({
      statement: `${evidence.field}: ${evidence.value}`,
      evidenceIds: [evidence.id],
    });
    hooks.push(`${evidence.field}:${evidence.value}`);
  }

  return {
    organizationId: input.organizationId,
    prospectId: input.prospectId,
    angle: input.angle,
    observations,
    hooks,
  };
}
