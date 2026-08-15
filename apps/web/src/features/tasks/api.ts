import { api } from '@/lib/api';
import type { PaginatedResult, Task } from '@/types';

export interface TasksQuery {
  page?: number;
  pageSize?: number;
  status?: Task['status'];
  leadId?: string;
}

export async function fetchTasks(query: TasksQuery = {}): Promise<PaginatedResult<Task>> {
  const { data } = await api.get<PaginatedResult<Task>>('/tasks', { params: query });
  return data;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueAt?: string;
  priority?: Task['priority'];
}

export async function createTask(input: CreateTaskInput & { leadId?: string }): Promise<Task> {
  const { data } = await api.post<Task>('/tasks', input);
  return data;
}

export async function createTaskForLead(leadId: string, input: CreateTaskInput): Promise<Task> {
  const { data } = await api.post<Task>(`/leads/${leadId}/tasks`, input);
  return data;
}

export async function updateTask(id: string, input: Partial<CreateTaskInput & { status: Task['status'] }>): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${id}`, input);
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
