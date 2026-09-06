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

export async function fetchFunnelConversion(
  filters: FunnelConversionFilters = {},
): Promise<FunnelConversion> {
  const { data } = await api.get<FunnelConversion>('/reports/funnel-conversion', {
    params: filters,
  });
  return data;
}
