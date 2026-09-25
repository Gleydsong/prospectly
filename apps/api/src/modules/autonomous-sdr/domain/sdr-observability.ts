import { InvalidSdrAuditError } from './sdr-errors';

const SECRET_TEXT = /bearer\s+\S+|token|password|secret|api[_-]?key/i;

export type AuditRecord = {
  organizationId: string;
  traceId: string;
  action: string;
  resource: string;
  reason: string;
  costCents: number;
};

export class SdrAuditLog {
  private readonly records: AuditRecord[] = [];

  record(input: AuditRecord): AuditRecord {
    const organizationId = required(input.organizationId, 'organizationId');
    const traceId = required(input.traceId, 'traceId');
    const action = required(input.action, 'action');
    const resource = required(input.resource, 'resource');
    const reason = required(input.reason, 'reason');
    if (!Number.isInteger(input.costCents) || input.costCents < 0) {
      throw new InvalidSdrAuditError('costCents must be a non-negative integer');
    }
    const stored: AuditRecord = {
      organizationId,
      traceId,
      action,
      resource,
      reason,
      costCents: input.costCents,
    };
    assertNoSecret(stored);
    this.records.push(stored);
    return stored;
  }

  read(organizationId: string): AuditRecord[] {
    return this.records.filter((record) => record.organizationId === organizationId);
  }

  metrics(organizationId: string): Record<string, number> {
    const totals: Record<string, number> = { costCents: 0 };
    for (const record of this.read(organizationId)) {
      totals[record.action] = (totals[record.action] ?? 0) + 1;
      totals.costCents = (totals.costCents ?? 0) + record.costCents;
    }
    return totals;
  }
}

function required(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InvalidSdrAuditError(`${field} is required`);
  }
  return value.trim();
}

function assertNoSecret(record: AuditRecord): void {
  const haystack = `${record.action} ${record.resource} ${record.reason}`;
  if (SECRET_TEXT.test(haystack)) throw new InvalidSdrAuditError('audit record contains a secret');
}
