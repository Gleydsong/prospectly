import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archiveWorkflow,
  createWorkflow,
  fetchWorkflows,
  pauseWorkflow,
  publishWorkflow,
  resumeWorkflow,
  updateWorkflow,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
} from './api';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkflowInput) => createWorkflow(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateWorkflowInput & { id: string }) =>
      updateWorkflow(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function usePublishWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishWorkflow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function usePauseWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pauseWorkflow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useResumeWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resumeWorkflow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useArchiveWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveWorkflow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}
