import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTask,
  createTaskForLead,
  fetchTasks,
  updateTask,
  type CreateTaskInput,
  type TasksQuery,
} from './api';
import type { Task } from '@/types';

export function useTasks(query: TasksQuery = {}) {
  return useQuery({ queryKey: ['tasks', query], queryFn: () => fetchTasks(query) });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput & { leadId?: string }) => createTask(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateTaskForLead(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTaskForLead(leadId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['leads', leadId] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<CreateTaskInput & { status: Task['status'] }>) =>
      updateTask(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
