import { api } from '@/lib/api';
import type { DashboardCharts, DashboardSummary } from '@/types';

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/dashboard/summary');
  return data;
}

export async function fetchDashboardCharts(): Promise<DashboardCharts> {
  const { data } = await api.get<DashboardCharts>('/dashboard/charts');
  return data;
}
