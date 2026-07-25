import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useCreateTask, useTasks, useUpdateTask } from '@/features/tasks/hooks';
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

const STATUS_LABEL: Record<Task['status'], string> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
};

export function TasksPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Task['status'] | ''>('');
  const [modalOpen, setModalOpen] = useState(false);

  const query = useTasks({ page, pageSize: 15, status: status || undefined });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Tarefas</h1>
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
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Card>

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
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <th scope="col" className="px-5 py-3 font-medium">Título</th>
                  <th scope="col" className="px-5 py-3 font-medium">Lead</th>
                  <th scope="col" className="px-5 py-3 font-medium">Vencimento</th>
                  <th scope="col" className="px-5 py-3 font-medium">Prioridade</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  <th scope="col" className="px-5 py-3 font-medium" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-zinc-50">
                    <td className="px-5 py-3 font-medium text-zinc-900">{task.title}</td>
                    <td className="px-5 py-3">
                      {task.lead ? (
                        <Link to={`/leads/${task.lead.id}`} className="text-brand-600 hover:underline">
                          {task.lead.companyName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-zinc-600">{formatDate(task.dueAt)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={task.priority === 'URGENT' || task.priority === 'HIGH' ? 'red' : 'slate'}>
                        {PRIORITY_LABEL[task.priority]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={task.status === 'DONE' ? 'green' : task.status === 'CANCELLED' ? 'slate' : 'blue'}>
                        {STATUS_LABEL[task.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {task.status !== 'DONE' && task.status !== 'CANCELLED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateTask.mutate({ id: task.id, status: 'DONE' })}
                        >
                          Concluir
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {meta ? (
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
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
