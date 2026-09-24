import { InvalidSdrEvidenceError } from './sdr-errors';

export const EVIDENCE_TYPES = [
  'WEBSITE',
  'PUBLIC_LISTING',
  'REVIEW',
  'CONTACT',
  'TECHNOLOGY',
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export type EvidenceSupport = 'SUPPORTED' | 'BLOCK';

export type EvidenceRecord = {
  id: string;
  organizationId: string;
  prospectId: string;
  type: EvidenceType;
  sourceUrl?: string;
  field: string;
  value: string;
  collectedAt: Date;
  expiresAt?: Date;
  confidence: number;
};

export type ObservationRecord = {
  id: string;
  organizationId: string;
  prospectId: string;
  statement: string;
  evidenceIds: string[];
};

const TYPES = new Set<string>(EVIDENCE_TYPES);

function fail(message: string): never {
  throw new InvalidSdrEvidenceError(message);
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(message);
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${field} is required`);
  return value.trim();
}

function parseInstant(value: unknown, field: string): Date {
  if (typeof value !== 'string') fail(`${field} is required`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(`${field} is not a timestamp`);
  return parsed;
}

function parseEvidence(input: unknown): EvidenceRecord {
  const record = asRecord(input, 'Evidence must be an object');
  const type = requiredText(record.type, 'type');
  if (!TYPES.has(type)) fail('type is not allowed');

  const collectedAt = parseInstant(record.collectedAt, 'collectedAt');
  const expiresAt =
    record.expiresAt === undefined ? undefined : parseInstant(record.expiresAt, 'expiresAt');
  if (expiresAt && expiresAt.getTime() <= collectedAt.getTime()) {
    fail('expiresAt must be after collectedAt');
  }

  if (typeof record.confidence !== 'number' || record.confidence < 0 || record.confidence > 1) {
    fail('confidence must be between 0 and 1');
  }
  if (typeof record.value !== 'string') fail('value must be untrusted text');

  const sourceUrl =
    record.sourceUrl === undefined ? undefined : requiredText(record.sourceUrl, 'sourceUrl');
  if (sourceUrl !== undefined && !sourceUrl.startsWith('https://')) {
    fail('sourceUrl must be https');
  }

  return {
    id: requiredText(record.id, 'id'),
    organizationId: requiredText(record.organizationId, 'organizationId'),
    prospectId: requiredText(record.prospectId, 'prospectId'),
    type: type as EvidenceType,
    sourceUrl,
    field: requiredText(record.field, 'field'),
    value: record.value,
    collectedAt,
    expiresAt,
    confidence: record.confidence,
  };
}

function usable(
  evidence: EvidenceRecord,
  organizationId: string,
  prospectId: string,
  at: Date,
): boolean {
  if (evidence.organizationId !== organizationId || evidence.prospectId !== prospectId)
    return false;
  if (evidence.expiresAt && at.getTime() >= evidence.expiresAt.getTime()) return false;
  return true;
}

export class OrganizationEvidenceLedger {
  private readonly evidence = new Map<string, EvidenceRecord>();
  private readonly observations: ObservationRecord[] = [];

  record(input: unknown): EvidenceRecord {
    const evidence = parseEvidence(input);
    const key = this.key(evidence.organizationId, evidence.id);
    if (this.evidence.has(key)) fail('evidence id already exists');
    this.evidence.set(key, evidence);
    return evidence;
  }

  read(organizationId: string, id: string): EvidenceRecord | undefined {
    return this.evidence.get(this.key(organizationId, id));
  }

  observe(input: unknown): ObservationRecord {
    const record = asRecord(input, 'Observation must be an object');
    const organizationId = requiredText(record.organizationId, 'organizationId');
    const prospectId = requiredText(record.prospectId, 'prospectId');
    if (!Array.isArray(record.evidenceIds) || record.evidenceIds.length === 0) {
      fail('observation requires evidence');
    }
    const evidenceIds = record.evidenceIds.map((id, index) => {
      if (typeof id !== 'string' || id.trim() === '') fail(`evidenceIds[${index}] is required`);
      const stored = this.read(organizationId, id.trim());
      if (!stored || stored.prospectId !== prospectId) fail('evidence is not in this organization');
      return id.trim();
    });

    const observation: ObservationRecord = {
      id: requiredText(record.id, 'id'),
      organizationId,
      prospectId,
      statement: requiredText(record.statement, 'statement'),
      evidenceIds,
    };
    this.observations.push(observation);
    return observation;
  }

  assess(
    organizationId: string,
    prospectId: string,
    evidenceIds: readonly string[],
    at: Date,
  ): EvidenceSupport {
    if (evidenceIds.length === 0) return 'BLOCK';
    const supported = evidenceIds.every((id) => {
      const stored = this.read(organizationId, id);
      return stored !== undefined && usable(stored, organizationId, prospectId, at);
    });
    return supported ? 'SUPPORTED' : 'BLOCK';
  }

  private key(organizationId: string, id: string): string {
    return `${organizationId}\u0000${id}`;
  }
}
