import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { BILLING_STATUS_QUERY_KEY } from '@/features/billing/hooks';
import type { CreateOpportunityRunInput } from '@/types';
import {
  createOpportunityRun,
  explainOpportunityCandidate,
  fetchOpportunityCandidates,
  fetchOpportunityRun,
  saveOpportunityAsLead,
  type OpportunityRankingCategory,
} from './api';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED']);

export function useCreateOpportunityRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOpportunityRunInput) => createOpportunityRun(input),
    onSuccess: (run) => {
      queryClient.setQueryData(['opportunity-finder', 'run', run.id], run);
      void queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY });
    },
  });
}

export function useOpportunityRun(runId: string) {
  return useQuery({
    queryKey: ['opportunity-finder', 'run', runId],
    queryFn: () => fetchOpportunityRun(runId),
    enabled: Boolean(runId),
    refetchInterval: (query) =>
      TERMINAL_STATUSES.has(query.state.data?.status ?? '') ? false : 2_000,
  });
}

export function useOpportunityCandidates(
  runId: string,
  category?: OpportunityRankingCategory,
  active = false,
) {
  return useQuery({
    queryKey: ['opportunity-finder', 'run', runId, 'candidates', category ?? 'ALL'],
    queryFn: () => fetchOpportunityCandidates(runId, category),
    enabled: Boolean(runId),
    refetchInterval: active ? 3_000 : false,
  });
}

export function useExplainOpportunityCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, candidateId }: { runId: string; candidateId: string }) =>
      explainOpportunityCandidate(runId, candidateId),
    onSuccess: (candidate) => {
      void queryClient.invalidateQueries({
        queryKey: ['opportunity-finder', 'run', candidate.runId, 'candidates'],
      });
    },
  });
}

export function useSaveOpportunityAsLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, candidateId }: { runId: string; candidateId: string }) =>
      saveOpportunityAsLead(runId, candidateId),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: ['opportunity-finder', 'run', input.runId, 'candidates'],
      });
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
