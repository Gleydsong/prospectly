import { api } from '@/lib/api';
import type { LeadSource } from '@/types';

import type { FunnelConversion, FunnelConversionFilters, ReportPeriod } from './api';

export interface SavedReportDefinition {
  period: ReportPeriod;
  source?: LeadSource;
  ownerId?: string;
}

export interface SavedReport {
  id: string;
  name: string;
  ownerId: string;
  definition: SavedReportDefinition;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export async function fetchSavedReports(): Promise<SavedReport[]> {
  const { data } = await api.get<SavedReport[]>('/saved-reports');
  return data;
}

export async function createSavedReport(input: {
  name: string;
  definition: SavedReportDefinition;
}): Promise<SavedReport> {
  const { data } = await api.post<SavedReport>('/saved-reports', input);
  return data;
}

export async function archiveSavedReport(id: string): Promise<SavedReport> {
  const { data } = await api.post<SavedReport>(`/saved-reports/${id}/archive`);
  return data;
}

export async function fetchSavedReportConversion(id: string): Promise<FunnelConversion> {
  const { data } = await api.get<FunnelConversion>(`/saved-reports/${id}/funnel-conversion`);
  return data;
}

export function savedReportToFilters(report: SavedReport): FunnelConversionFilters {
  return {
    period: report.definition.period,
    source: report.definition.source,
    ownerId: report.definition.ownerId,
  };
}
