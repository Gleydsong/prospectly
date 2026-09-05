import type { LeadStatus } from '@/types';

import type { LeadsQuery } from '@/features/leads/api';

import type { LeadViewDefinition, LeadFilterNode } from './api';

type LeadFilterGroup = Extract<LeadFilterNode, { nodes: LeadFilterNode[] }>;
type LeadFilterLeaf = Exclude<LeadFilterNode, LeadFilterGroup>;

export type LastContactOp = '' | 'older_than' | 'within';
export type HasWebsiteFilter = '' | 'yes' | 'no';

export type LeadListFilters = {
  q: string;
  status: LeadStatus | '';
  statusOr: LeadStatus | '';
  hasWebsite: HasWebsiteFilter;
  lastContactOp: LastContactOp;
  lastContactDays: number;
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
    extras: {},
  };
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
    Boolean(filters.status) &&
    Boolean(filters.statusOr) &&
    filters.status !== filters.statusOr;
  return distinctOr || Boolean(filters.lastContactOp);
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
    default:
      break;
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
    return;
  }
  if (!isGroup(node)) {
    applyLeaf(node, filters);
  }
}

function hydrateFromAst(definition: LeadViewDefinition): LeadListFilters {
  const filters = emptyLeadListFilters();
  filters.extras = {
    ...(definition.sortBy ? { sortBy: definition.sortBy } : {}),
    ...(definition.sortOrder ? { sortOrder: definition.sortOrder } : {}),
  };
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
  const { q, status, hasWebsite, ...rest } = definition;
  return {
    q: q ?? '',
    status: (status as LeadStatus | undefined) ?? '',
    statusOr: '',
    hasWebsite: hasWebsite === true ? 'yes' : hasWebsite === false ? 'no' : '',
    lastContactOp: '',
    lastContactDays: DEFAULT_LAST_CONTACT_DAYS,
    extras: rest,
  };
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

export function definitionFromFilters(filters: LeadListFilters): LeadViewDefinition {
  const extras = { ...filters.extras };
  delete extras.filter;

  if (!needsAst(filters)) {
    const status = filters.status || filters.statusOr;
    return {
      ...extras,
      ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
      ...(status ? { status } : {}),
      ...(filters.hasWebsite === '' ? {} : { hasWebsite: filters.hasWebsite === 'yes' }),
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
  };
}

export function leadsQueryFromFilters(filters: LeadListFilters, page: number): LeadsQuery {
  const definition = definitionFromFilters(filters);
  if (definition.filter) {
    return {
      page,
      pageSize: 15,
      filter: definition.filter,
      sortBy: definition.sortBy ?? 'createdAt',
      sortOrder: definition.sortOrder ?? 'desc',
    };
  }
  return {
    page,
    pageSize: 15,
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
