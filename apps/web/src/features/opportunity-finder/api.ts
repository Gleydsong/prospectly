import type {
  CreateOpportunityRunInput,
  OpportunityCandidateView,
  OpportunityRunView,
} from '@/types';
import { api } from '@/lib/api';

export type OpportunityRankingCategory = 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export async function createOpportunityRun(
  input: CreateOpportunityRunInput,
): Promise<OpportunityRunView> {
  const { data } = await api.post<OpportunityRunView>('/opportunity-finder/runs', input);
  return data;
}

export async function fetchOpportunityRun(id: string): Promise<OpportunityRunView> {
  const { data } = await api.get<OpportunityRunView>(`/opportunity-finder/runs/${id}`);
  return data;
}

export async function fetchOpportunityCandidates(
  runId: string,
  category?: OpportunityRankingCategory,
): Promise<{ data: OpportunityCandidateView[]; total: number }> {
  const { data } = await api.get<{ data: OpportunityCandidateView[]; total: number }>(
    `/opportunity-finder/runs/${runId}/candidates`,
    { params: { pageSize: 100, ...(category ? { category } : {}) } },
  );
  return data;
}

export async function explainOpportunityCandidate(
  runId: string,
  candidateId: string,
): Promise<OpportunityCandidateView> {
  const { data } = await api.post<OpportunityCandidateView>(
    `/opportunity-finder/runs/${runId}/candidates/${candidateId}/explanation`,
  );
  return data;
}

export async function saveOpportunityAsLead(
  runId: string,
  candidateId: string,
): Promise<{ status: string; leadId: string | null }> {
  const { data } = await api.post<{ status: string; leadId: string | null }>(
    `/opportunity-finder/runs/${runId}/candidates/${candidateId}/save-lead`,
  );
  return data;
}
