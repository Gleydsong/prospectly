import { CustomFieldType, LeadSource, LeadStatus, type Prisma } from '@prisma/client';

export const FILTER_MAX_DEPTH = 3;
export const FILTER_MAX_NODES = 20;
export const FILTER_MAX_CHILDREN = 8;
export const RELATIVE_DAYS_MIN = 1;
export const RELATIVE_DAYS_MAX = 365;
export const CUSTOM_FIELD_FILTER_PREFIX = 'custom:';
const CUSTOM_FIELD_NUMBER_ABS = 1_000_000_000_000;
const CUSTOM_FIELD_TEXT_MAX = 500;

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
  | { field: 'createdAt'; op: 'older_than' | 'within'; days: number }
  | CustomFieldFilterLeaf;

export type CustomFieldFilterLeaf =
  | { field: `custom:${string}`; op: 'eq'; value: string | number }
  | { field: `custom:${string}`; op: 'gte' | 'lte'; value: number }
  | { field: `custom:${string}`; op: 'older_than' | 'within'; days: number };

export type CustomFieldFilterCatalog = ReadonlyMap<string, CustomFieldType>;

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
    throw new InvalidLeadFilterError(
      `Filter group cannot have more than ${FILTER_MAX_CHILDREN} nodes`,
    );
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
    return {
      field,
      op: 'eq',
      value: assertBoundedString(field, raw.value, field === 'q' ? 200 : 120),
    };
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

export function customFieldFilterField(id: string): string {
  return `${CUSTOM_FIELD_FILTER_PREFIX}${id}`;
}

export function customFieldIdFromFilterField(field: string): string | null {
  if (!field.startsWith(CUSTOM_FIELD_FILTER_PREFIX)) {
    return null;
  }
  const id = field.slice(CUSTOM_FIELD_FILTER_PREFIX.length);
  return UUID_RE.test(id) ? id : null;
}

export function isCustomFieldFilterLeaf(node: LeadFilterLeaf): node is CustomFieldFilterLeaf {
  return customFieldIdFromFilterField(node.field) !== null;
}

function parseRelativeDays(raw: Record<string, unknown>, label: string): number {
  if (raw.value !== undefined) {
    throw new InvalidLeadFilterError(`${label} must use days, not value`);
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
  return raw.days;
}

function assertFiniteNumber(value: unknown, label: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Math.abs(value) > CUSTOM_FIELD_NUMBER_ABS
  ) {
    throw new InvalidLeadFilterError(`${label} must be a finite number`);
  }
  return value;
}

function parseCustomFieldLeaf(raw: Record<string, unknown>, field: string): CustomFieldFilterLeaf {
  const customField = field as `custom:${string}`;
  if (raw.op === 'contains') {
    throw new InvalidLeadFilterError('custom field does not support contains');
  }
  if (
    raw.op !== 'eq' &&
    raw.op !== 'gte' &&
    raw.op !== 'lte' &&
    raw.op !== 'older_than' &&
    raw.op !== 'within'
  ) {
    throw new InvalidLeadFilterError(
      'custom field only supports eq, gte, lte, older_than or within',
    );
  }
  if (raw.op === 'older_than' || raw.op === 'within') {
    return { field: customField, op: raw.op, days: parseRelativeDays(raw, 'custom field') };
  }
  if (raw.days !== undefined) {
    throw new InvalidLeadFilterError('custom field must use value, not days');
  }
  if (raw.op === 'gte' || raw.op === 'lte') {
    return {
      field: customField,
      op: raw.op,
      value: assertFiniteNumber(raw.value, 'custom field range value'),
    };
  }
  if (typeof raw.value === 'number') {
    return {
      field: customField,
      op: 'eq',
      value: assertFiniteNumber(raw.value, 'custom field value'),
    };
  }
  return {
    field: customField,
    op: 'eq',
    value: assertBoundedString('value', raw.value, CUSTOM_FIELD_TEXT_MAX),
  };
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
  if (customFieldIdFromFilterField(raw.field)) {
    return parseCustomFieldLeaf(raw, raw.field);
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

function utcCalendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcCalendarDays(day: string, delta: number): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

function relativeCalendarCutoff(days: number, now: Date): string {
  return addUtcCalendarDays(utcCalendarDay(now), -days);
}

function compileCustomFieldLeaf(node: CustomFieldFilterLeaf, now: Date): Prisma.LeadWhereInput {
  const id = customFieldIdFromFilterField(node.field);
  if (!id) {
    throw new InvalidLeadFilterError(`Unknown filter field: ${node.field}`);
  }
  switch (node.op) {
    case 'eq':
      return { customFieldValues: { path: [id], equals: node.value } };
    case 'gte':
      return { customFieldValues: { path: [id], gte: node.value } };
    case 'lte':
      return { customFieldValues: { path: [id], lte: node.value } };
    case 'within':
      return { customFieldValues: { path: [id], gte: relativeCalendarCutoff(node.days, now) } };
    case 'older_than':
      return { customFieldValues: { path: [id], lt: relativeCalendarCutoff(node.days, now) } };
  }
}

export function walkLeadFilterLeaves(
  node: LeadFilterNode,
  visit: (leaf: LeadFilterLeaf) => void,
): void {
  if ('nodes' in node) {
    for (const child of node.nodes) {
      walkLeadFilterLeaves(child, visit);
    }
    return;
  }
  visit(node);
}

export function hasCustomFieldLeaves(node: LeadFilterNode): boolean {
  let found = false;
  walkLeadFilterLeaves(node, (leaf) => {
    if (isCustomFieldFilterLeaf(leaf)) {
      found = true;
    }
  });
  return found;
}

export function collectCustomFieldFilterIds(node: LeadFilterNode): string[] {
  const ids: string[] = [];
  walkLeadFilterLeaves(node, (leaf) => {
    const id = customFieldIdFromFilterField(leaf.field);
    if (id) {
      ids.push(id);
    }
  });
  return ids;
}

function assertCustomFieldLeafMatchesType(
  leaf: CustomFieldFilterLeaf,
  type: CustomFieldType,
): void {
  if (type === CustomFieldType.TEXT) {
    if (leaf.op !== 'eq' || typeof leaf.value !== 'string') {
      throw new InvalidLeadFilterError('Custom field operator is not allowed for this type');
    }
    return;
  }
  if (type === CustomFieldType.SELECT) {
    if (leaf.op !== 'eq' || typeof leaf.value !== 'string' || !UUID_RE.test(leaf.value)) {
      throw new InvalidLeadFilterError('Custom field operator is not allowed for this type');
    }
    return;
  }
  if (type === CustomFieldType.NUMBER) {
    if (leaf.op !== 'eq' && leaf.op !== 'gte' && leaf.op !== 'lte') {
      throw new InvalidLeadFilterError('Custom field operator is not allowed for this type');
    }
    if (typeof leaf.value !== 'number') {
      throw new InvalidLeadFilterError('Custom field value does not match field type');
    }
    return;
  }
  if (leaf.op === 'older_than' || leaf.op === 'within') {
    return;
  }
  if (
    leaf.op !== 'eq' ||
    typeof leaf.value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(leaf.value)
  ) {
    throw new InvalidLeadFilterError('Custom field operator is not allowed for this type');
  }
}

export function assertCustomFieldFilter(
  node: LeadFilterNode,
  catalog: CustomFieldFilterCatalog,
): void {
  walkLeadFilterLeaves(node, (leaf) => {
    if (!isCustomFieldFilterLeaf(leaf)) {
      return;
    }
    const id = customFieldIdFromFilterField(leaf.field);
    if (!id) {
      throw new InvalidLeadFilterError('Unknown custom field');
    }
    const type = catalog.get(id);
    if (!type) {
      throw new InvalidLeadFilterError('Unknown custom field');
    }
    assertCustomFieldLeafMatchesType(leaf, type);
  });
}

function compileLeaf(node: LeadFilterLeaf, now: Date): Prisma.LeadWhereInput {
  if (isCustomFieldFilterLeaf(node)) {
    return compileCustomFieldLeaf(node, now);
  }
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
      return node.value ? { website: { not: null } } : { OR: [{ website: null }, { website: '' }] };
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
