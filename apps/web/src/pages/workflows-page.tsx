import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  buildWorkflowDraftDefinition,
  filterModeFromDefinition,
  tagNameFromDefinition,
  type Workflow,
  type WorkflowFilterMode,
  type WorkflowStatus,
} from '@/features/workflows/api';
import {
  useArchiveWorkflow,
  useCreateWorkflow,
  usePauseWorkflow,
  usePublishWorkflow,
  useResumeWorkflow,
  useUpdateWorkflow,
  useWorkflows,
} from '@/features/workflows/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  tagName: z.string().max(40),
  filterMode: z.enum(['all', 'noWebsite']),
});

type FormValues = z.infer<typeof schema>;

const STATUS_TONE: Record<WorkflowStatus, 'slate' | 'green' | 'amber' | 'red'> = {
  DRAFT: 'slate',
  ACTIVE: 'green',
  PAUSED: 'amber',
  ARCHIVED: 'red',
};

const EMPTY_FORM: FormValues = {
  name: '',
  description: '',
  tagName: '',
  filterMode: 'all',
};

export function WorkflowsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const canWrite = user?.role !== Role.VIEWER;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);

  const workflowsQuery = useWorkflows();
  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow();
  const publishMutation = usePublishWorkflow();
  const pauseMutation = usePauseWorkflow();
  const resumeMutation = useResumeWorkflow();
  const archiveMutation = useArchiveWorkflow();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  const definitionLocked = editing !== null && editing.status !== 'DRAFT';
  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    publishMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    archiveMutation.isPending;

  function openCreate() {
    setEditing(null);
    setError(null);
    form.reset(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(workflow: Workflow) {
    setEditing(workflow);
    setError(null);
    form.reset({
      name: workflow.name,
      description: workflow.description ?? '',
      tagName: tagNameFromDefinition(workflow.draftDefinition),
      filterMode: filterModeFromDefinition(workflow.draftDefinition),
    });
    setOpen(true);
  }

  async function persist(values: FormValues, publish: boolean) {
    if (!canWrite) return;
    setError(null);
    if (publish && !values.tagName.trim()) {
      setError(t('workflows.tagRequiredToPublish'));
      return;
    }
    const definition = buildWorkflowDraftDefinition({
      tagName: values.tagName,
      filterMode: values.filterMode as WorkflowFilterMode,
    });
    try {
      let current = editing;
      if (current) {
        current = await updateMutation.mutateAsync({
          id: current.id,
          name: values.name,
          description: values.description || null,
          ...(current.status === 'DRAFT' ? { definition } : {}),
        });
      } else {
        current = await createMutation.mutateAsync({
          name: values.name,
          description: values.description || undefined,
          definition,
        });
      }
      if (publish) {
        current = await publishMutation.mutateAsync(current.id);
        setLiveMessage(t('workflows.publishSuccess', { name: current.name }));
      } else {
        setLiveMessage(t('workflows.createSuccess', { name: current.name }));
      }
      form.reset(EMPTY_FORM);
      setEditing(null);
      setOpen(false);
    } catch (err) {
      setError(
        getApiErrorMessage(err) || t(publish ? 'workflows.publishError' : 'workflows.createError'),
      );
    }
  }

  async function runAction(action: () => Promise<Workflow>, successKey: string) {
    setError(null);
    try {
      const result = await action();
      setLiveMessage(t(successKey, { name: result.name }));
    } catch (err) {
      setLiveMessage(getApiErrorMessage(err) || t('workflows.actionError'));
    }
  }

  const rows = workflowsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.groupConvert')}
        title={t('workflows.title')}
        description={t('workflows.subtitle')}
        actions={
          canWrite ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              {t('workflows.create')}
            </Button>
          ) : null
        }
      />

      <Card
        className="border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[color:var(--ink)]"
        role="note"
      >
        {t('workflows.executionNotice')}
      </Card>

      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {workflowsQuery.isLoading ? (
        <TableSkeleton rows={5} />
      ) : workflowsQuery.isError ? (
        <Card className="p-6 text-sm text-red-300" role="alert">
          {t('workflows.loadError')}
          <div className="mt-3">
            <Button type="button" variant="ghost" onClick={() => void workflowsQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('workflows.emptyTitle')}
          description={t('workflows.emptyDescription')}
          action={
            canWrite ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {t('workflows.create')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--ink-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('workflows.columns.name')}</th>
                  <th className="px-4 py-3 font-medium">{t('workflows.columns.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('workflows.columns.trigger')}</th>
                  <th className="px-4 py-3 font-medium">{t('workflows.columns.updated')}</th>
                  <th className="px-4 py-3 font-medium">{t('workflows.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((workflow) => (
                  <tr
                    key={workflow.id}
                    className="border-b border-[color:var(--border)] text-[color:var(--ink)]"
                  >
                    <td className="px-4 py-3">
                      {workflow.canEdit ? (
                        <button
                          type="button"
                          className="font-medium text-[color:var(--ink)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                          onClick={() => openEdit(workflow)}
                        >
                          {workflow.name}
                        </button>
                      ) : (
                        <span className="font-medium text-[color:var(--ink)]">{workflow.name}</span>
                      )}
                      {workflow.description ? (
                        <div className="mt-0.5 line-clamp-1 text-xs text-[color:var(--ink-muted)]">
                          {workflow.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[workflow.status]}>
                        {t(`workflows.status.${workflow.status}`, {
                          defaultValue: workflow.status,
                        })}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">
                      {t('workflows.trigger')}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">
                      {formatDate(workflow.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {workflow.canEdit ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(workflow)}
                          >
                            {t('workflows.edit')}
                          </Button>
                          {workflow.status === 'DRAFT' &&
                          tagNameFromDefinition(workflow.draftDefinition) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void runAction(
                                  () => publishMutation.mutateAsync(workflow.id),
                                  'workflows.publishSuccess',
                                )
                              }
                            >
                              {t('workflows.publish')}
                            </Button>
                          ) : null}
                          {workflow.status === 'ACTIVE' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void runAction(
                                  () => pauseMutation.mutateAsync(workflow.id),
                                  'workflows.createSuccess',
                                )
                              }
                            >
                              {t('workflows.pause')}
                            </Button>
                          ) : null}
                          {workflow.status === 'PAUSED' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void runAction(
                                  () => resumeMutation.mutateAsync(workflow.id),
                                  'workflows.createSuccess',
                                )
                              }
                            >
                              {t('workflows.resume')}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void runAction(
                                () => archiveMutation.mutateAsync(workflow.id),
                                'workflows.createSuccess',
                              )
                            }
                          >
                            {t('workflows.archive')}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[color:var(--ink-muted)]">{t('common.dash')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('workflows.editTitle') : t('workflows.createTitle')}
      >
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => persist(values, false))}
        >
          <Input
            id="workflow-name"
            label={t('workflows.fields.name')}
            {...form.register('name')}
            autoFocus
          />
          {form.formState.errors.name ? (
            <p className="text-xs text-red-400">{form.formState.errors.name.message}</p>
          ) : null}
          <Input
            id="workflow-description"
            label={t('workflows.fields.description')}
            {...form.register('description')}
          />
          <p className="text-sm text-[color:var(--ink-muted)]">{t('workflows.trigger')}</p>
          <Select
            id="workflow-filter"
            label={t('workflows.fields.filter')}
            disabled={definitionLocked}
            {...form.register('filterMode')}
          >
            <option value="all">{t('workflows.fields.filterAll')}</option>
            <option value="noWebsite">{t('workflows.fields.filterNoWebsite')}</option>
          </Select>
          <Input
            id="workflow-tag"
            label={t('workflows.fields.tagName')}
            placeholder={t('workflows.fields.tagPlaceholder')}
            disabled={definitionLocked}
            {...form.register('tagName')}
          />
          <p className="text-xs text-[color:var(--ink-muted)]">{t('workflows.executionNotice')}</p>
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            {canWrite && (!editing || editing.canEdit) && !definitionLocked ? (
              <Button type="submit" loading={pending}>
                {t('workflows.saveDraft')}
              </Button>
            ) : null}
            {canWrite && (!editing || (editing.canEdit && editing.status === 'DRAFT')) ? (
              <Button
                type="button"
                loading={pending}
                onClick={() => void form.handleSubmit((values) => persist(values, true))()}
              >
                {t('workflows.publish')}
              </Button>
            ) : null}
          </div>
        </form>
      </Modal>
    </div>
  );
}
