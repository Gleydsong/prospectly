import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createActivity,
  createLead,
  deleteLead,
  fetchLead,
  fetchLeadActivities,
  fetchLeads,
  fetchTags,
  updateLead,
  type CreateActivityInput,
  type CreateLeadInput,
  type LeadsQuery,
} from './api';

export function useLeads(query: LeadsQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['leads', query],
    queryFn: () => fetchLeads(query),
    placeholderData: (previous) => previous,
    enabled: options?.enabled ?? true,
  });
}

export function useLead(id: string) {
  return useQuery({ queryKey: ['leads', id], queryFn: () => fetchLead(id), enabled: Boolean(id) });
}

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: fetchTags });
}

export function useLeadActivities(leadId: string) {
  return useQuery({
    queryKey: ['leads', leadId, 'activities'],
    queryFn: () => fetchLeadActivities(leadId),
    enabled: Boolean(leadId),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadInput) => createLead(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateLeadInput>) => updateLead(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

export function useCreateActivity(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateActivityInput) => createActivity(leadId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads', leadId, 'activities'] });
      void queryClient.invalidateQueries({ queryKey: ['leads', leadId] });
    },
  });
}
