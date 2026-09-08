import { getTenantContext } from './tenant-context';

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

/** Membership rows: require ALS, never inject organizationId (login/switch). */
export const MEMBERSHIP_MODELS = new Set(['OrganizationMember']);

/** Models keyed by organizationId (or Organization.id). */
export const TENANT_MODELS = new Set([
  'Organization',
  'Lead',
  'Tag',
  'LeadActivity',
  'Task',
  'Pipeline',
  'Search',
  'Import',
  'Campaign',
  'CampaignActivity',
  'MessageTemplate',
  'Integration',
  'PluginToken',
  'AuditLog',
  'ScoreConfiguration',
  'UsageLedger',
  'CreditPurchase',
  'MonthlyCheckoutAttempt',
  'BillingProfile',
  'CreditLedgerEntry',
  'OpportunityRun',
  'AiRun',
  'DataSubjectRequest',
  'SuppressionEntry',
  'OutboxEvent',
  'SavedView',
  'Workflow',
  'WorkflowVersion',
  'WorkflowStepRun',
  'CustomFieldDefinition',
  'GoogleConnection',
  'SyncedCommunication',
]);

/** Child rows without organizationId — require an active tenant context. */
export const CHILD_MODELS = new Set([
  'LeadContact',
  'LeadTag',
  'PipelineStage',
  'Website',
  'WebsiteAnalysis',
  'WebsiteAnalysisIssue',
  'ScoreRule',
  'LeadScore',
  'SearchResult',
  'ImportError',
  'CampaignLead',
  'OpportunityCandidate',
]);

export const GLOBAL_MODELS = new Set([
  'User',
  'WaitlistEntry',
  'BillingWebhookEvent',
  'RefreshToken',
  'ConsentRecord',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function whereHasOrganizationId(where: unknown): boolean {
  if (!isRecord(where)) return false;
  if (typeof where.organizationId === 'string' && where.organizationId.length > 0) return true;
  if (isRecord(where.organizationId) && typeof where.organizationId.equals === 'string')
    return true;
  for (const key of ['AND', 'OR', 'NOT'] as const) {
    const part = where[key];
    if (Array.isArray(part) && part.some(whereHasOrganizationId)) return true;
    if (whereHasOrganizationId(part)) return true;
  }
  for (const nested of [
    'pipeline',
    'lead',
    'search',
    'campaign',
    'run',
    'organization',
    'config',
    'website',
    'import',
    'opportunityRun',
  ]) {
    if (whereHasOrganizationId(where[nested])) return true;
  }
  return false;
}

function dataHasOrganizationId(data: unknown): boolean {
  if (Array.isArray(data)) return data.every(dataHasOrganizationId);
  return (
    isRecord(data) && typeof data.organizationId === 'string' && data.organizationId.length > 0
  );
}

function whereOrgValue(where: unknown): string | null {
  if (!isRecord(where)) return null;
  if (typeof where.organizationId === 'string') return where.organizationId;
  if (isRecord(where.organizationId) && typeof where.organizationId.equals === 'string') {
    return where.organizationId.equals;
  }
  return null;
}

/**
 * Enforce tenant scope for Prisma operations.
 * Mutates `args.where` to inject ALS organizationId when missing on tenant models.
 */
export function assertTenantOperation(model: string, operation: string, args: unknown): void {
  const ctx = getTenantContext();
  if (!ctx || ctx.bypass) return;
  if (GLOBAL_MODELS.has(model)) return;

  if (CHILD_MODELS.has(model) || MEMBERSHIP_MODELS.has(model)) {
    if (!ctx.organizationId) {
      throw new TenantScopeError(`Tenant context missing for ${model}.${operation}`);
    }
    return;
  }

  if (!TENANT_MODELS.has(model)) return;

  if (!ctx.organizationId) {
    throw new TenantScopeError(`Tenant context missing for ${model}.${operation}`);
  }

  const payload = isRecord(args) ? args : {};

  if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
    if (!dataHasOrganizationId(payload.data)) {
      throw new TenantScopeError(`${model}.${operation} requires data.organizationId`);
    }
    return;
  }

  if (operation === 'upsert') {
    if (!dataHasOrganizationId(payload.create)) {
      throw new TenantScopeError(`${model}.upsert requires create.organizationId`);
    }
    const stated = whereOrgValue(payload.where);
    if (stated && stated !== ctx.organizationId) {
      throw new TenantScopeError(`${model}.upsert organizationId does not match tenant context`);
    }
    if (!whereHasOrganizationId(payload.where)) {
      payload.where = {
        ...(isRecord(payload.where) ? payload.where : {}),
        organizationId: ctx.organizationId,
      };
    }
    return;
  }

  if (model === 'Organization') {
    const where = isRecord(payload.where) ? payload.where : {};
    if (typeof where.id === 'string' && where.id !== ctx.organizationId) {
      throw new TenantScopeError('Organization query id does not match tenant context');
    }
    if (typeof where.id !== 'string' && !whereHasOrganizationId(where)) {
      payload.where = { ...where, id: ctx.organizationId };
    }
    return;
  }

  const stated = whereOrgValue(payload.where);
  if (stated && stated !== ctx.organizationId) {
    throw new TenantScopeError(
      `${model}.${operation} organizationId does not match tenant context`,
    );
  }

  if (!whereHasOrganizationId(payload.where)) {
    payload.where = {
      ...(isRecord(payload.where) ? payload.where : {}),
      organizationId: ctx.organizationId,
    };
  }
}
