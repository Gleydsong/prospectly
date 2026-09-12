import { LeadSource } from '@prisma/client';

import { REPORT_PERIODS, type ReportPeriod } from './dto/query-funnel-conversion.dto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFINITION_KEYS = new Set(['period', 'source', 'ownerId']);

export class InvalidSavedReportDefinitionError extends Error {
  constructor() {
    super('Saved report definition is not allowlisted');
    this.name = 'InvalidSavedReportDefinitionError';
  }
}

export type SavedReportDefinition = {
  period: ReportPeriod;
  source?: LeadSource;
  ownerId?: string;
};

export function normalizeSavedReportName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function parseSavedReportDefinition(raw: unknown): SavedReportDefinition {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InvalidSavedReportDefinitionError();
  }
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).some((key) => !DEFINITION_KEYS.has(key))) {
    throw new InvalidSavedReportDefinitionError();
  }
  if (!isReportPeriod(record.period)) {
    throw new InvalidSavedReportDefinitionError();
  }
  const definition: SavedReportDefinition = { period: record.period };
  if (record.source !== undefined) {
    if (!isLeadSource(record.source)) {
      throw new InvalidSavedReportDefinitionError();
    }
    definition.source = record.source;
  }
  if (record.ownerId !== undefined) {
    if (typeof record.ownerId !== 'string' || !UUID_RE.test(record.ownerId)) {
      throw new InvalidSavedReportDefinitionError();
    }
    definition.ownerId = record.ownerId;
  }
  return definition;
}

function isReportPeriod(value: unknown): value is ReportPeriod {
  return typeof value === 'string' && (REPORT_PERIODS as readonly string[]).includes(value);
}

function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === 'string' && (Object.values(LeadSource) as string[]).includes(value);
}
