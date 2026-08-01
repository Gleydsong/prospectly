import { api } from '@/lib/api';
import type { DashboardCharts, DashboardFilters, DashboardSummary } from '@/types';

export async function fetchDashboardSummary(filters: DashboardFilters = {}): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/dashboard/summary', { params: filters });
  return data;
}

export async function fetchDashboardCharts(filters: DashboardFilters = {}): Promise<DashboardCharts> {
  const { data } = await api.get<DashboardCharts>('/dashboard/charts', { params: filters });
  return data;
}
