import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '@/features/tasks/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { TASK_STATUS_LABELS } from '@/lib/presentation-labels';
import { cn, formatDate } from '@/lib/utils';
import type { Task } from '@/types';

const taskSchema = z.object({
  title: z.string().min(2, 'Título obrigatório'),
  dueAt: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

type QuickFilter = 'all' | 'today' | 'overdue' | 'done';

function isDueToday(dueAt?: string | null): boolean {
  if (!dueAt) return false;
  const d = new Date(dueAt);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isDueOverdue(dueAt?: string | null, status?: Task['status']): boolean {
  if (!dueAt || status === 'DONE' || status === 'CANCELLED') return false;
  const d = new Date(dueAt);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return d.getTime() < todayStart;
}

export function TasksPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Task['status'] | ''>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const query = useTasks({ page, pageSize: 15, status: status || undefined });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [actionError, setActionError] = useState<string | null>(null);

  const removeTask = async (task: Task) => {
    const confirmed = window.confirm(`Apagar a tarefa "${task.title}"?`);
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteTask.mutateAsync(task.id);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: 'MEDIUM' },
  });

  const tasks = query.data?.data ?? [];
  const meta = query.data?.meta;

  const filteredTasks = tasks.filter((task) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchLead = task.lead?.companyName?.toLowerCase().includes(q);
      if (!matchTitle && !matchLead) return false;
    }
    if (quickFilter === 'today') {
      return isDueToday(task.dueAt);
    }
    if (quickFilter === 'overdue') {
      return isDueOverdue(task.dueAt, task.status);
    }
    if (quickFilter === 'done') {
      return task.status === 'DONE';
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">{t('leads.tasks')}</h1>
          <p className="text-sm text-[color:var(--ink-muted)]">Acompanhe os próximos passos com os clientes</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova tarefa
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-muted)]" aria-hidden />
              <Input
                placeholder="Buscar por título ou cliente…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                aria-label="Buscar tarefas"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value as Task['status'] | '');
                }}
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtro rápido por prazo">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'today', label: 'Hoje' },
                { id: 'overdue', label: 'Atrasadas' },
                { id: 'done', label: 'Concluídas' },
              ] as const
            ).map((chip) => {
              const active = quickFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setQuickFilter(chip.id);
                  }}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-[color:var(--accent)] text-white shadow-xs'
                      : 'bg-[color:var(--surface-subtle)] text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)] border border-[color:var(--border)]',
                  )}
                  aria-pressed={active}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      {query.isLoading ? (
        <Card className="p-5">
          <TableSkeleton rows={6} columns={4} />
        </Card>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa"
          description="Crie tarefas para não perder follow-ups importantes."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Nova tarefa
            </Button>
          }
        />
      ) : filteredTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium text-[color:var(--ink)]">Nenhuma tarefa encontrada</p>
          <p className="mt-1 text-sm text-[color:var(--ink-muted)]">Tente ajustar a busca ou os filtros selecionados.</p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-[color:var(--border)] md:hidden">
              {filteredTasks.map((task) => (
                <li key={task.id} className="space-y-2 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-[color:var(--ink)]">{task.title}</p>
                    <Badge
                      tone={
                        task.priority === 'URGENT' || task.priority === 'HIGH' ? 'red' : 'slate'
                      }
                    >
                      {PRIORITY_LABEL[task.priority]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <TaskLeadLink lead={task.lead} />
                    <span className="text-xs text-[color:var(--ink-muted)]">{formatDate(task.dueAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      tone={
                        task.status === 'DONE'
                          ? 'green'
                          : task.status === 'CANCELLED'
                            ? 'slate'
                            : 'blue'
                      }
                    >
                      {TASK_STATUS_LABELS[task.status]}
                    </Badge>
                    <TaskRowActions
                      task={task}
                      deletingTask={deleteTask.isPending && deleteTask.variables === task.id}
                      onComplete={() => updateTask.mutate({ id: task.id, status: 'DONE' })}
                      onDeleteTask={removeTask}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                    <th scope="col" className="px-5 py-3 font-medium">
                      Título
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Cliente
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Vencimento
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Prioridade
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="border-b border-[color:var(--border)]">
                      <td className="px-5 py-3 font-medium text-[color:var(--ink)]">{task.title}</td>
                      <td className="px-5 py-3">
                        <TaskLeadLink lead={task.lead} />
                      </td>
                      <td className="px-5 py-3 text-[color:var(--ink)]">{formatDate(task.dueAt)}</td>
                      <td className="px-5 py-3">
                        <Badge
                          tone={
                            task.priority === 'URGENT' || task.priority === 'HIGH' ? 'red' : 'slate'
                          }
                        >
                          {PRIORITY_LABEL[task.priority]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          tone={
                            task.status === 'DONE'
                              ? 'green'
                              : task.status === 'CANCELLED'
                                ? 'slate'
                                : 'blue'
                          }
                        >
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <TaskRowActions
                          task={task}
                          deletingTask={deleteTask.isPending && deleteTask.variables === task.id}
                          onComplete={() => updateTask.mutate({ id: task.id, status: 'DONE' })}
                          onDeleteTask={removeTask}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {meta ? (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          reset({ priority: 'MEDIUM' });
          setModalOpen(false);
        }}
        title="Nova tarefa"
      >
        <form
          onSubmit={handleSubmit(async (values) => {
            await createTask.mutateAsync({
              title: values.title,
              dueAt: values.dueAt || undefined,
              priority: values.priority,
            });
            reset({ priority: 'MEDIUM' });
            setModalOpen(false);
          })}
          className="space-y-4"
        >
          <Input label="Título" error={errors.title?.message} {...register('title')} />
          <Input label="Vencimento" type="date" {...register('dueAt')} />
          <Select label="Prioridade" {...register('priority')}>
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Criar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TaskLeadLink({ lead }: { lead: Task['lead'] }) {
  if (!lead) {
    return <span className="text-[color:var(--ink-muted)]">—</span>;
  }

  return (
    <Link to={`/leads/${lead.id}`} className="truncate text-brand-400 hover:underline">
      {lead.companyName}
    </Link>
  );
}

function TaskRowActions({
  task,
  deletingTask,
  onComplete,
  onDeleteTask,
}: {
  task: Task;
  deletingTask: boolean;
  onComplete: () => void;
  onDeleteTask: (task: Task) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {task.status !== 'DONE' && task.status !== 'CANCELLED' ? (
        <Button size="sm" variant="outline" onClick={onComplete}>
          Concluir
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        aria-label={`Apagar tarefa ${task.title}`}
        loading={deletingTask}
        onClick={() => onDeleteTask(task)}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
