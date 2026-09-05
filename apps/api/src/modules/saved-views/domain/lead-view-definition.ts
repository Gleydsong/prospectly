import { LeadSource, LeadStatus } from '@prisma/client';

import { SORTABLE_FIELDS, type LeadSortField } from '../../leads/dto/query-leads.dto';

export const LEAD_VIEW_DEFINITION_KEYS = [
  'q',
  'status',
  'source',
  'category',
  'segment',
  'city',
  'ownerId',
  'tagId',
  'minScore',
  'maxScore',
  'hasWebsite',
  'sortBy',
  'sortOrder',
] as const;

export type LeadViewDefinitionKey = (typeof LEAD_VIEW_DEFINITION_KEYS)[number];

export type LeadViewDefinition = {
  q?: string;
  status?: LeadStatus;
  source?: LeadSource;
  category?: string;
  segment?: string;
  city?: string;
  ownerId?: string;
  tagId?: string;
  minScore?: number;
  maxScore?: number;
  hasWebsite?: boolean;
  sortBy?: LeadSortField;
  sortOrder?: 'asc' | 'desc';
};

const ALLOWED_KEYS = new Set<string>(LEAD_VIEW_DEFINITION_KEYS);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEAD_STATUSES = new Set<string>(Object.values(LeadStatus));
const LEAD_SOURCES = new Set<string>(Object.values(LeadSource));
const SORT_FIELDS = new Set<string>(SORTABLE_FIELDS);

export class InvalidLeadViewDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLeadViewDefinitionError';
  }
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidLeadViewDefinitionError('View definition must be a JSON object');
  }
}

function assertBoundedString(key: string, value: unknown, max: number): string {
  if (typeof value !== 'string') {
    throw new InvalidLeadViewDefinitionError(`${key} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InvalidLeadViewDefinitionError(`${key} must not be empty`);
  }
  if (trimmed.length > max) {
    throw new InvalidLeadViewDefinitionError(`${key} is too long`);
  }
  if (/[;\n]|--|\/\*/.test(trimmed)) {
    throw new InvalidLeadViewDefinitionError(`${key} contains disallowed characters`);
  }
  return trimmed;
}

export function parseLeadViewDefinition(raw: unknown): LeadViewDefinition {
  assertPlainObject(raw);

  const unknownKeys = Object.keys(raw).filter((key) => !ALLOWED_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new InvalidLeadViewDefinitionError(`Unknown definition keys: ${unknownKeys.join(', ')}`);
  }

  const definition: LeadViewDefinition = {};

  if (raw.q !== undefined) {
    definition.q = assertBoundedString('q', raw.q, 200);
  }
  if (raw.status !== undefined) {
    if (typeof raw.status !== 'string' || !LEAD_STATUSES.has(raw.status)) {
      throw new InvalidLeadViewDefinitionError('status is not an allowed lead status');
    }
    definition.status = raw.status as LeadStatus;
  }
  if (raw.source !== undefined) {
    if (typeof raw.source !== 'string' || !LEAD_SOURCES.has(raw.source)) {
      throw new InvalidLeadViewDefinitionError('source is not an allowed lead source');
    }
    definition.source = raw.source as LeadSource;
  }
  if (raw.category !== undefined) {
    definition.category = assertBoundedString('category', raw.category, 120);
  }
  if (raw.segment !== undefined) {
    definition.segment = assertBoundedString('segment', raw.segment, 120);
  }
  if (raw.city !== undefined) {
    definition.city = assertBoundedString('city', raw.city, 120);
  }
  if (raw.ownerId !== undefined) {
    if (typeof raw.ownerId !== 'string' || !UUID_RE.test(raw.ownerId)) {
      throw new InvalidLeadViewDefinitionError('ownerId must be a UUID');
    }
    definition.ownerId = raw.ownerId;
  }
  if (raw.tagId !== undefined) {
    if (typeof raw.tagId !== 'string' || !UUID_RE.test(raw.tagId)) {
      throw new InvalidLeadViewDefinitionError('tagId must be a UUID');
    }
    definition.tagId = raw.tagId;
  }
  if (raw.minScore !== undefined) {
    if (
      typeof raw.minScore !== 'number' ||
      !Number.isInteger(raw.minScore) ||
      raw.minScore < 0 ||
      raw.minScore > 100
    ) {
      throw new InvalidLeadViewDefinitionError('minScore must be an integer between 0 and 100');
    }
    definition.minScore = raw.minScore;
  }
  if (raw.maxScore !== undefined) {
    if (
      typeof raw.maxScore !== 'number' ||
      !Number.isInteger(raw.maxScore) ||
      raw.maxScore < 0 ||
      raw.maxScore > 100
    ) {
      throw new InvalidLeadViewDefinitionError('maxScore must be an integer between 0 and 100');
    }
    definition.maxScore = raw.maxScore;
  }
  if (
    definition.minScore !== undefined &&
    definition.maxScore !== undefined &&
    definition.minScore > definition.maxScore
  ) {
    throw new InvalidLeadViewDefinitionError('minScore cannot be greater than maxScore');
  }
  if (raw.hasWebsite !== undefined) {
    if (typeof raw.hasWebsite !== 'boolean') {
      throw new InvalidLeadViewDefinitionError('hasWebsite must be a boolean');
    }
    definition.hasWebsite = raw.hasWebsite;
  }
  if (raw.sortBy !== undefined) {
    if (typeof raw.sortBy !== 'string' || !SORT_FIELDS.has(raw.sortBy)) {
      throw new InvalidLeadViewDefinitionError('sortBy is not an allowed field');
    }
    definition.sortBy = raw.sortBy as LeadSortField;
  }
  if (raw.sortOrder !== undefined) {
    if (raw.sortOrder !== 'asc' && raw.sortOrder !== 'desc') {
      throw new InvalidLeadViewDefinitionError('sortOrder must be asc or desc');
    }
    definition.sortOrder = raw.sortOrder;
  }

  return definition;
}
