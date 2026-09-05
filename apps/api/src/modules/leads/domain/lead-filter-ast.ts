import { LeadSource, LeadStatus, type Prisma } from '@prisma/client';

export const FILTER_MAX_DEPTH = 3;
export const FILTER_MAX_NODES = 20;
export const FILTER_MAX_CHILDREN = 8;
export const RELATIVE_DAYS_MIN = 1;
export const RELATIVE_DAYS_MAX = 365;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEAD_STATUSES = new Set<string>(Object.values(LeadStatus));
const LEAD_SOURCES = new Set<string>(Object.values(LeadSource));
const EQ_FIELDS = new Set([
  'q',
  'status',
  'source',
  'category',
  'segment',
  'city',
  'ownerId',
  'tagId',
  'hasWebsite',
]);
const RELATIVE_FIELDS = new Set(['lastContactAt', 'createdAt']);
const MS_PER_DAY = 86_400_000;

export class InvalidLeadFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLeadFilterError';
  }
}

export type LeadFilterGroup = {
  op: 'and' | 'or';
  nodes: LeadFilterNode[];
};

export type LeadFilterLeaf =
  | { field: 'q'; op: 'eq'; value: string }
  | { field: 'status'; op: 'eq'; value: LeadStatus }
  | { field: 'source'; op: 'eq'; value: LeadSource }
  | { field: 'category'; op: 'eq'; value: string }
  | { field: 'segment'; op: 'eq'; value: string }
  | { field: 'city'; op: 'eq'; value: string }
  | { field: 'ownerId'; op: 'eq'; value: string }
  | { field: 'tagId'; op: 'eq'; value: string }
  | { field: 'hasWebsite'; op: 'eq'; value: boolean }
  | { field: 'score'; op: 'gte' | 'lte'; value: number }
  | { field: 'lastContactAt'; op: 'older_than' | 'within'; days: number }
  | { field: 'createdAt'; op: 'older_than' | 'within'; days: number };

export type LeadFilterNode = LeadFilterGroup | LeadFilterLeaf;

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidLeadFilterError('Filter must be a JSON object');
  }
}

function assertBoundedString(key: string, value: unknown, max: number): string {
  if (typeof value !== 'string') {
    throw new InvalidLeadFilterError(`${key} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InvalidLeadFilterError(`${key} must not be empty`);
  }
  if (trimmed.length > max) {
    throw new InvalidLeadFilterError(`${key} is too long`);
  }
  if (/[;\n]|--|\/\*/.test(trimmed)) {
    throw new InvalidLeadFilterError(`${key} contains disallowed characters`);
  }
  return trimmed;
}

function parseGroup(
  raw: Record<string, unknown>,
  depth: number,
  counter: { count: number },
): LeadFilterGroup {
  const extra = Object.keys(raw).filter((key) => key !== 'op' && key !== 'nodes');
  if (extra.length > 0) {
    throw new InvalidLeadFilterError(`Unknown filter keys: ${extra.join(', ')}`);
  }
  if (!Array.isArray(raw.nodes)) {
    throw new InvalidLeadFilterError('Filter group nodes must be an array');
  }
  if (raw.nodes.length === 0) {
    throw new InvalidLeadFilterError('Filter group must not be empty');
  }
  if (raw.nodes.length > FILTER_MAX_CHILDREN) {
    throw new InvalidLeadFilterError(`Filter group cannot have more than ${FILTER_MAX_CHILDREN} nodes`);
  }
  const op = raw.op as 'and' | 'or';
  return {
    op,
    nodes: raw.nodes.map((child) => parseNode(child, depth + 1, counter)),
  };
}

function parseEqLeaf(raw: Record<string, unknown>): LeadFilterLeaf {
  const field = raw.field;
  if (typeof field !== 'string' || !EQ_FIELDS.has(field)) {
    throw new InvalidLeadFilterError('Filter field is not allowed');
  }
  if (raw.op !== 'eq') {
    throw new InvalidLeadFilterError(`${field} only supports eq`);
  }
  if (raw.days !== undefined) {
    throw new InvalidLeadFilterError(`${field} must use value, not days`);
  }
  if (field === 'q' || field === 'category' || field === 'segment' || field === 'city') {
    return { field, op: 'eq', value: assertBoundedString(field, raw.value, field === 'q' ? 200 : 120) };
  }
  if (field === 'status') {
    if (typeof raw.value !== 'string' || !LEAD_STATUSES.has(raw.value)) {
      throw new InvalidLeadFilterError('status is not an allowed lead status');
    }
    return { field: 'status', op: 'eq', value: raw.value as LeadStatus };
  }
  if (field === 'source') {
    if (typeof raw.value !== 'string' || !LEAD_SOURCES.has(raw.value)) {
      throw new InvalidLeadFilterError('source is not an allowed lead source');
    }
    return { field: 'source', op: 'eq', value: raw.value as LeadSource };
  }
  if (field === 'ownerId' || field === 'tagId') {
    if (typeof raw.value !== 'string' || !UUID_RE.test(raw.value)) {
      throw new InvalidLeadFilterError(`${field} must be a UUID`);
    }
    return { field, op: 'eq', value: raw.value };
  }
  if (typeof raw.value !== 'boolean') {
    throw new InvalidLeadFilterError('hasWebsite must be a boolean');
  }
  return { field: 'hasWebsite', op: 'eq', value: raw.value };
}

function parseScoreLeaf(raw: Record<string, unknown>): LeadFilterLeaf {
  if (raw.op !== 'gte' && raw.op !== 'lte') {
    throw new InvalidLeadFilterError('score only supports gte or lte');
  }
  if (raw.days !== undefined) {
    throw new InvalidLeadFilterError('score must use value, not days');
  }
  if (
    typeof raw.value !== 'number' ||
    !Number.isInteger(raw.value) ||
    raw.value < 0 ||
    raw.value > 100
  ) {
    throw new InvalidLeadFilterError('score must be an integer between 0 and 100');
  }
  return { field: 'score', op: raw.op, value: raw.value };
}

function parseRelativeLeaf(raw: Record<string, unknown>): LeadFilterLeaf {
  const field = raw.field;
  if (field !== 'lastContactAt' && field !== 'createdAt') {
    throw new InvalidLeadFilterError('Filter field is not allowed');
  }
  if (raw.op !== 'older_than' && raw.op !== 'within') {
    throw new InvalidLeadFilterError(`${field} only supports older_than or within`);
  }
  if (raw.value !== undefined) {
    throw new InvalidLeadFilterError(`${field} must use days, not value`);
  }
  if (
    typeof raw.days !== 'number' ||
    !Number.isInteger(raw.days) ||
    raw.days < RELATIVE_DAYS_MIN ||
    raw.days > RELATIVE_DAYS_MAX
  ) {
    throw new InvalidLeadFilterError(
      `days must be an integer between ${RELATIVE_DAYS_MIN} and ${RELATIVE_DAYS_MAX}`,
    );
  }
  return { field, op: raw.op, days: raw.days };
}

function parseLeaf(raw: Record<string, unknown>): LeadFilterLeaf {
  const extra = Object.keys(raw).filter(
    (key) => key !== 'field' && key !== 'op' && key !== 'value' && key !== 'days',
  );
  if (extra.length > 0) {
    throw new InvalidLeadFilterError(`Unknown filter keys: ${extra.join(', ')}`);
  }
  if (typeof raw.field !== 'string') {
    throw new InvalidLeadFilterError('Filter field is required');
  }
  if (EQ_FIELDS.has(raw.field)) {
    return parseEqLeaf(raw);
  }
  if (raw.field === 'score') {
    return parseScoreLeaf(raw);
  }
  if (RELATIVE_FIELDS.has(raw.field)) {
    return parseRelativeLeaf(raw);
  }
  throw new InvalidLeadFilterError(`Unknown filter field: ${raw.field}`);
}

function parseNode(raw: unknown, depth: number, counter: { count: number }): LeadFilterNode {
  if (depth > FILTER_MAX_DEPTH) {
    throw new InvalidLeadFilterError(`Filter depth cannot exceed ${FILTER_MAX_DEPTH}`);
  }
  counter.count += 1;
  if (counter.count > FILTER_MAX_NODES) {
    throw new InvalidLeadFilterError(`Filter cannot have more than ${FILTER_MAX_NODES} nodes`);
  }
  assertPlainObject(raw);
  const isGroup = raw.op === 'and' || raw.op === 'or';
  const isLeaf = typeof raw.field === 'string';
  if (isGroup && isLeaf) {
    throw new InvalidLeadFilterError('Filter node cannot be both a group and a leaf');
  }
  if (isGroup) {
    return parseGroup(raw, depth, counter);
  }
  if (isLeaf) {
    return parseLeaf(raw);
  }
  throw new InvalidLeadFilterError('Filter node must be a group or a leaf');
}

export function parseLeadFilter(raw: unknown): LeadFilterNode {
  return parseNode(raw, 1, { count: 0 });
}

export function coerceLeadFilter(raw: unknown): LeadFilterNode {
  if (typeof raw === 'string') {
    try {
      return parseLeadFilter(JSON.parse(raw) as unknown);
    } catch (error) {
      if (error instanceof InvalidLeadFilterError) {
        throw error;
      }
      throw new InvalidLeadFilterError('filter must be valid JSON');
    }
  }
  return parseLeadFilter(raw);
}

function relativeCutoff(days: number, now: Date): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

function compileLeaf(node: LeadFilterLeaf, now: Date): Prisma.LeadWhereInput {
  switch (node.field) {
    case 'q':
      return {
        OR: [
          { companyName: { contains: node.value, mode: 'insensitive' } },
          { tradeName: { contains: node.value, mode: 'insensitive' } },
          { email: { contains: node.value, mode: 'insensitive' } },
          { domain: { contains: node.value, mode: 'insensitive' } },
        ],
      };
    case 'status':
      return { status: node.value };
    case 'source':
      return { source: node.value };
    case 'category':
      return { category: { equals: node.value, mode: 'insensitive' } };
    case 'segment':
      return { segment: { equals: node.value, mode: 'insensitive' } };
    case 'city':
      return { city: { equals: node.value, mode: 'insensitive' } };
    case 'ownerId':
      return { ownerId: node.value };
    case 'tagId':
      return { tags: { some: { tagId: node.value } } };
    case 'hasWebsite':
      return node.value
        ? { website: { not: null } }
        : { OR: [{ website: null }, { website: '' }] };
    case 'score':
      return { score: node.op === 'gte' ? { gte: node.value } : { lte: node.value } };
    case 'lastContactAt':
    case 'createdAt': {
      const cutoff = relativeCutoff(node.days, now);
      if (node.op === 'within') {
        return { [node.field]: { gte: cutoff } };
      }
      return {
        OR: [{ [node.field]: { lt: cutoff } }, { [node.field]: null }],
      };
    }
  }
}

export function compileLeadFilter(
  node: LeadFilterNode,
  now: Date = new Date(),
): Prisma.LeadWhereInput {
  if ('nodes' in node) {
    const compiled = node.nodes.map((child) => compileLeadFilter(child, now));
    return node.op === 'and' ? { AND: compiled } : { OR: compiled };
  }
  return compileLeaf(node, now);
}
