import { api } from '@/lib/api';
import type { LeadSource } from '@/types';

export type ReportPeriod = '7d' | '30d' | '90d';

export interface FunnelConversionSourceRow {
  source: string;
  inflow: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface FunnelConversion {
  period: ReportPeriod;
  periodStart: string;
  inflow: number;
  wins: number;
  losses: number;
  winRate: number;
  bySource: FunnelConversionSourceRow[];
}

export interface FunnelConversionFilters {
  period?: ReportPeriod;
  source?: LeadSource;
  ownerId?: string;
}

export type ReportBucket = 'inflow' | 'wins' | 'losses';

export interface FunnelConversionLeads {
  bucket: ReportBucket;
  period: ReportPeriod;
  ids: string[];
  total: number;
}

export async function fetchFunnelConversion(
  filters: FunnelConversionFilters = {},
): Promise<FunnelConversion> {
  const { data } = await api.get<FunnelConversion>('/reports/funnel-conversion', {
    params: filters,
  });
  return data;
}

export async function fetchFunnelConversionLeads(
  filters: FunnelConversionFilters & { bucket: ReportBucket },
): Promise<FunnelConversionLeads> {
  const { data } = await api.get<FunnelConversionLeads>('/reports/funnel-conversion/leads', {
    params: filters,
  });
  return data;
}

export function reportLeadsPath(
  bucket: ReportBucket,
  filters: FunnelConversionFilters,
): string {
  const params = new URLSearchParams();
  params.set('reportBucket', bucket);
  if (filters.period) params.set('period', filters.period);
  if (filters.source) params.set('source', filters.source);
  if (filters.ownerId) params.set('ownerId', filters.ownerId);
  return `/leads?${params.toString()}`;
}
