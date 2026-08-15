import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
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
import { useDeleteLead } from '@/features/leads/hooks';
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '@/features/tasks/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { TASK_STATUS_LABELS } from '@/lib/presentation-labels';
import { formatDate } from '@/lib/utils';
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

export function TasksPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Task['status'] | ''>('');
  const [modalOpen, setModalOpen] = useState(false);

  const query = useTasks({ page, pageSize: 15, status: status || undefined });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteLead = useDeleteLead();
  const deleteTask = useDeleteTask();
  const [actionError, setActionError] = useState<string | null>(null);

  const removeLead = async (leadId: string, companyName: string) => {
    const confirmed = window.confirm(
      `Apagar o cliente "${companyName}"? Ele será removido da lista de clientes potenciais.`,
    );
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteLead.mutateAsync(leadId);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  };

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t('leads.tasks')}</h1>
          <p className="text-sm text-zinc-500">Acompanhe próximos passos com os leads</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova tarefa
        </Button>
      </div>

      <Card className="p-4">
        <Select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as Task['status'] | '');
          }}
          className="max-w-xs"
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
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
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-zinc-800 md:hidden">
              {tasks.map((task) => (
                <li key={task.id} className="space-y-2 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-zinc-50">{task.title}</p>
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
                    <span className="text-xs text-zinc-400">{formatDate(task.dueAt)}</span>
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
                      deletingLead={deleteLead.isPending && deleteLead.variables === task.lead?.id}
                      deletingTask={deleteTask.isPending && deleteTask.variables === task.id}
                      onComplete={() => updateTask.mutate({ id: task.id, status: 'DONE' })}
                      onDeleteLead={removeLead}
                      onDeleteTask={removeTask}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                    <th scope="col" className="px-5 py-3 font-medium">
                      Título
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Cliente potencial
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
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-b border-zinc-800">
                      <td className="px-5 py-3 font-medium text-zinc-50">{task.title}</td>
                      <td className="px-5 py-3">
                        <TaskLeadLink lead={task.lead} />
                      </td>
                      <td className="px-5 py-3 text-zinc-300">{formatDate(task.dueAt)}</td>
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
                          deletingLead={
                            deleteLead.isPending && deleteLead.variables === task.lead?.id
                          }
                          deletingTask={deleteTask.isPending && deleteTask.variables === task.id}
                          onComplete={() => updateTask.mutate({ id: task.id, status: 'DONE' })}
                          onDeleteLead={removeLead}
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
    return <span className="text-zinc-500">—</span>;
  }

  return (
    <Link to={`/leads/${lead.id}`} className="truncate text-brand-400 hover:underline">
      {lead.companyName}
    </Link>
  );
}

function TaskRowActions({
  task,
  deletingLead,
  deletingTask,
  onComplete,
  onDeleteLead,
  onDeleteTask,
}: {
  task: Task;
  deletingLead: boolean;
  deletingTask: boolean;
  onComplete: () => void;
  onDeleteLead: (leadId: string, companyName: string) => void;
  onDeleteTask: (task: Task) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {task.status !== 'DONE' && task.status !== 'CANCELLED' ? (
        <Button size="sm" variant="outline" onClick={onComplete}>
          Concluir
        </Button>
      ) : null}
      {task.lead ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          aria-label={`Apagar cliente ${task.lead.companyName}`}
          loading={deletingLead}
          onClick={() => onDeleteLead(task.lead!.id, task.lead!.companyName)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      ) : (
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
      )}
    </div>
  );
}
