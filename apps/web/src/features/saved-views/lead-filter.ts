import type { LeadStatus } from '@/types';

import type { LeadsQuery } from '@/features/leads/api';

import type { LeadViewDefinition, LeadFilterNode } from './api';

type LeadFilterGroup = Extract<LeadFilterNode, { nodes: LeadFilterNode[] }>;
type LeadFilterLeaf = Exclude<LeadFilterNode, LeadFilterGroup>;

export type LastContactOp = '' | 'older_than' | 'within';
export type HasWebsiteFilter = '' | 'yes' | 'no';
export type LeadViewLayout = 'table' | 'kanban';
export type BuiltinLeadViewColumnKey =
  'companyName' | 'city' | 'status' | 'score' | 'owner' | 'tags' | 'segment' | 'email' | 'website';
export type LeadViewColumnKey = BuiltinLeadViewColumnKey | string;
export type CustomFieldFilterOp = 'eq' | 'gte' | 'lte' | 'older_than' | 'within';

export type CustomFieldListFilter = {
  fieldId: string;
  op: CustomFieldFilterOp;
  value?: string | number;
  days?: number;
};

export const LEAD_VIEW_COLUMN_KEYS: BuiltinLeadViewColumnKey[] = [
  'companyName',
  'city',
  'status',
  'score',
  'owner',
  'tags',
  'segment',
  'email',
  'website',
];

export const DEFAULT_LEAD_VIEW_COLUMNS: BuiltinLeadViewColumnKey[] = [
  'companyName',
  'city',
  'status',
  'score',
  'owner',
  'tags',
];

export const KANBAN_PAGE_SIZE = 50;
export const CUSTOM_FIELD_FILTER_PREFIX = 'custom:';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LeadListFilters = {
  q: string;
  status: LeadStatus | '';
  statusOr: LeadStatus | '';
  hasWebsite: HasWebsiteFilter;
  lastContactOp: LastContactOp;
  lastContactDays: number;
  layout: LeadViewLayout;
  columns: LeadViewColumnKey[];
  customFilters: CustomFieldListFilter[];
  extras: LeadViewDefinition;
};

export const DEFAULT_LAST_CONTACT_DAYS = 14;

export function emptyLeadListFilters(): LeadListFilters {
  return {
    q: '',
    status: '',
    statusOr: '',
    hasWebsite: '',
    lastContactOp: '',
    lastContactDays: DEFAULT_LAST_CONTACT_DAYS,
    layout: 'table',
    columns: [...DEFAULT_LEAD_VIEW_COLUMNS],
    customFilters: [],
    extras: {},
  };
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

export function isBuiltinLeadViewColumn(column: string): column is BuiltinLeadViewColumnKey {
  return (LEAD_VIEW_COLUMN_KEYS as string[]).includes(column);
}

export function isCustomFieldColumnId(column: string): boolean {
  return UUID_RE.test(column);
}

export function toggleLeadViewColumn(
  current: LeadViewColumnKey[],
  column: LeadViewColumnKey,
): LeadViewColumnKey[] {
  if (column === 'companyName') {
    return current;
  }
  if (current.includes(column)) {
    return current.filter((value) => value !== column);
  }
  if (isBuiltinLeadViewColumn(column)) {
    const builtins = LEAD_VIEW_COLUMN_KEYS.filter((key) => key === column || current.includes(key));
    const custom = current.filter((key) => !isBuiltinLeadViewColumn(key));
    return [...builtins, ...custom];
  }
  return [...current, column];
}

function isGroup(node: LeadFilterNode): node is LeadFilterGroup {
  return 'nodes' in node && Array.isArray(node.nodes);
}

function clampDays(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return DEFAULT_LAST_CONTACT_DAYS;
  }
  return Math.min(365, Math.max(1, value));
}

function needsAst(filters: LeadListFilters): boolean {
  const distinctOr =
    Boolean(filters.status) && Boolean(filters.statusOr) && filters.status !== filters.statusOr;
  return distinctOr || Boolean(filters.lastContactOp) || hasCompleteCustomFilters(filters);
}

function isCompleteCustomFilter(item: CustomFieldListFilter): boolean {
  if (!UUID_RE.test(item.fieldId)) {
    return false;
  }
  if (item.op === 'older_than' || item.op === 'within') {
    return true;
  }
  return item.value !== undefined && item.value !== '';
}

function hasCompleteCustomFilters(filters: LeadListFilters): boolean {
  return filters.customFilters.some(isCompleteCustomFilter);
}

function applyLeaf(leaf: LeadFilterLeaf, filters: LeadListFilters): void {
  switch (leaf.field) {
    case 'q':
      if (typeof leaf.value === 'string') filters.q = leaf.value;
      break;
    case 'status':
      if (typeof leaf.value === 'string') filters.status = leaf.value as LeadStatus;
      break;
    case 'hasWebsite':
      if (typeof leaf.value === 'boolean') filters.hasWebsite = leaf.value ? 'yes' : 'no';
      break;
    case 'lastContactAt':
      if (leaf.op === 'older_than' || leaf.op === 'within') {
        filters.lastContactOp = leaf.op;
        if (typeof leaf.days === 'number') filters.lastContactDays = clampDays(leaf.days);
      }
      break;
    case 'source':
      if (typeof leaf.value === 'string') filters.extras.source = leaf.value;
      break;
    case 'category':
      if (typeof leaf.value === 'string') filters.extras.category = leaf.value;
      break;
    case 'segment':
      if (typeof leaf.value === 'string') filters.extras.segment = leaf.value;
      break;
    case 'city':
      if (typeof leaf.value === 'string') filters.extras.city = leaf.value;
      break;
    case 'ownerId':
      if (typeof leaf.value === 'string') filters.extras.ownerId = leaf.value;
      break;
    case 'tagId':
      if (typeof leaf.value === 'string') filters.extras.tagId = leaf.value;
      break;
    case 'score':
      if (typeof leaf.value === 'number' && leaf.op === 'gte') filters.extras.minScore = leaf.value;
      if (typeof leaf.value === 'number' && leaf.op === 'lte') filters.extras.maxScore = leaf.value;
      break;
    default: {
      const fieldId = customFieldIdFromFilterField(leaf.field);
      if (!fieldId) break;
      const op = leaf.op as CustomFieldFilterOp;
      if (op === 'older_than' || op === 'within') {
        filters.customFilters.push({
          fieldId,
          op,
          days: typeof leaf.days === 'number' ? clampDays(leaf.days) : DEFAULT_LAST_CONTACT_DAYS,
        });
        break;
      }
      if (typeof leaf.value === 'string' || typeof leaf.value === 'number') {
        filters.customFilters.push({ fieldId, op: op || 'eq', value: leaf.value });
      }
    }
  }
}

function applyNode(node: LeadFilterNode, filters: LeadListFilters): void {
  if (isGroup(node) && node.op === 'or') {
    const statuses = node.nodes.filter(
      (child): child is LeadFilterLeaf =>
        !isGroup(child) && child.field === 'status' && typeof child.value === 'string',
    );
    const [first, second] = statuses;
    if (!first?.value || !second?.value || statuses.length !== node.nodes.length) {
      return;
    }
    filters.status = first.value as LeadStatus;
    filters.statusOr = second.value as LeadStatus;
    return;
  }
  if (!isGroup(node)) {
    applyLeaf(node, filters);
  }
}

function applyDisplay(definition: LeadViewDefinition, filters: LeadListFilters): void {
  if (definition.layout === 'kanban' || definition.layout === 'table') {
    filters.layout = definition.layout;
  }
  if (Array.isArray(definition.columns) && definition.columns.length > 0) {
    filters.columns = definition.columns.filter(
      (column): column is LeadViewColumnKey =>
        isBuiltinLeadViewColumn(column) || isCustomFieldColumnId(column),
    );
    if (!filters.columns.includes('companyName')) {
      filters.columns = ['companyName', ...filters.columns];
    }
  }
}

function isDefaultColumns(columns: LeadViewColumnKey[]): boolean {
  return (
    columns.length === DEFAULT_LEAD_VIEW_COLUMNS.length &&
    columns.every((column, index) => column === DEFAULT_LEAD_VIEW_COLUMNS[index])
  );
}

function displayDefinition(
  filters: LeadListFilters,
): Pick<LeadViewDefinition, 'layout' | 'columns'> {
  return {
    ...(filters.layout === 'kanban' ? { layout: 'kanban' as const } : {}),
    ...(isDefaultColumns(filters.columns) ? {} : { columns: filters.columns }),
  };
}

function hydrateFromAst(definition: LeadViewDefinition): LeadListFilters {
  const filters = emptyLeadListFilters();
  filters.extras = {
    ...(definition.sortBy ? { sortBy: definition.sortBy } : {}),
    ...(definition.sortOrder ? { sortOrder: definition.sortOrder } : {}),
  };
  applyDisplay(definition, filters);
  const root = definition.filter;
  if (!root) return filters;
  const nodes = isGroup(root) && root.op === 'and' ? root.nodes : [root];
  for (const node of nodes) {
    applyNode(node, filters);
  }
  return filters;
}

export function hydrateLeadListFilters(definition: LeadViewDefinition): LeadListFilters {
  if (definition.filter) {
    return hydrateFromAst(definition);
  }
  const { q, status, hasWebsite, layout, columns, ...rest } = definition;
  const filters = emptyLeadListFilters();
  filters.q = q ?? '';
  filters.status = (status as LeadStatus | undefined) ?? '';
  filters.hasWebsite = hasWebsite === true ? 'yes' : hasWebsite === false ? 'no' : '';
  filters.extras = rest;
  applyDisplay({ layout, columns }, filters);
  return filters;
}

function extrasLeaves(extras: LeadViewDefinition): LeadFilterNode[] {
  const nodes: LeadFilterNode[] = [];
  if (extras.source) nodes.push({ field: 'source', op: 'eq', value: extras.source });
  if (extras.category) nodes.push({ field: 'category', op: 'eq', value: extras.category });
  if (extras.segment) nodes.push({ field: 'segment', op: 'eq', value: extras.segment });
  if (extras.city) nodes.push({ field: 'city', op: 'eq', value: extras.city });
  if (extras.ownerId) nodes.push({ field: 'ownerId', op: 'eq', value: extras.ownerId });
  if (extras.tagId) nodes.push({ field: 'tagId', op: 'eq', value: extras.tagId });
  if (extras.minScore !== undefined) {
    nodes.push({ field: 'score', op: 'gte', value: extras.minScore });
  }
  if (extras.maxScore !== undefined) {
    nodes.push({ field: 'score', op: 'lte', value: extras.maxScore });
  }
  return nodes;
}

function customFilterLeaves(filters: CustomFieldListFilter[]): LeadFilterNode[] {
  const nodes: LeadFilterNode[] = [];
  for (const item of filters) {
    if (!isCompleteCustomFilter(item)) {
      continue;
    }
    if (item.op === 'older_than' || item.op === 'within') {
      nodes.push({
        field: customFieldFilterField(item.fieldId),
        op: item.op,
        days: clampDays(item.days ?? DEFAULT_LAST_CONTACT_DAYS),
      });
      continue;
    }
    nodes.push({
      field: customFieldFilterField(item.fieldId),
      op: item.op,
      value: item.value,
    });
  }
  return nodes;
}

export function definitionFromFilters(filters: LeadListFilters): LeadViewDefinition {
  const extras = { ...filters.extras };
  delete extras.filter;
  delete extras.layout;
  delete extras.columns;

  if (!needsAst(filters)) {
    const status = filters.status || filters.statusOr;
    return {
      ...extras,
      ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
      ...(status ? { status } : {}),
      ...(filters.hasWebsite === '' ? {} : { hasWebsite: filters.hasWebsite === 'yes' }),
      ...displayDefinition(filters),
    };
  }

  const nodes: LeadFilterNode[] = [];
  if (filters.q.trim()) {
    nodes.push({ field: 'q', op: 'eq', value: filters.q.trim() });
  }

  const primary = filters.status;
  const secondary = filters.statusOr;
  if (primary && secondary && primary !== secondary) {
    nodes.push({
      op: 'or',
      nodes: [
        { field: 'status', op: 'eq', value: primary },
        { field: 'status', op: 'eq', value: secondary },
      ],
    });
  } else if (primary || secondary) {
    nodes.push({ field: 'status', op: 'eq', value: primary || secondary });
  }

  if (filters.hasWebsite !== '') {
    nodes.push({ field: 'hasWebsite', op: 'eq', value: filters.hasWebsite === 'yes' });
  }

  nodes.push(...extrasLeaves(extras));
  nodes.push(...customFilterLeaves(filters.customFilters));

  if (filters.lastContactOp) {
    nodes.push({
      field: 'lastContactAt',
      op: filters.lastContactOp,
      days: clampDays(filters.lastContactDays),
    });
  }

  return {
    filter: { op: 'and', nodes },
    ...(extras.sortBy ? { sortBy: extras.sortBy } : {}),
    ...(extras.sortOrder ? { sortOrder: extras.sortOrder } : {}),
    ...displayDefinition(filters),
  };
}

export function leadsQueryFromFilters(filters: LeadListFilters, page: number): LeadsQuery {
  const definition = definitionFromFilters(filters);
  const pageSize = filters.layout === 'kanban' ? KANBAN_PAGE_SIZE : 15;
  if (definition.filter) {
    return {
      page,
      pageSize,
      filter: definition.filter,
      sortBy: definition.sortBy ?? 'createdAt',
      sortOrder: definition.sortOrder ?? 'desc',
    };
  }
  return {
    page,
    pageSize,
    q: definition.q,
    status: definition.status,
    hasWebsite: definition.hasWebsite,
    source: definition.source,
    category: definition.category,
    segment: definition.segment,
    city: definition.city,
    ownerId: definition.ownerId,
    tagId: definition.tagId,
    minScore: definition.minScore,
    maxScore: definition.maxScore,
    sortBy: definition.sortBy ?? 'createdAt',
    sortOrder: definition.sortOrder ?? 'desc',
  };
}

export function leadExportFiltersFromList(filters: LeadListFilters): {
  q?: string;
  status?: LeadStatus;
  source?: string;
  category?: string;
  segment?: string;
  city?: string;
  ownerId?: string;
  tagId?: string;
  hasWebsite?: boolean;
  minScore?: number;
  maxScore?: number;
  filter?: LeadFilterNode;
} {
  const definition = definitionFromFilters(filters);
  if (definition.filter) {
    return { filter: definition.filter };
  }
  return {
    q: definition.q,
    status: definition.status,
    source: definition.source,
    category: definition.category,
    segment: definition.segment,
    city: definition.city,
    ownerId: definition.ownerId,
    tagId: definition.tagId,
    hasWebsite: definition.hasWebsite,
    minScore: definition.minScore,
    maxScore: definition.maxScore,
  };
}
