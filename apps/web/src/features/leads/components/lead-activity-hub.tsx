import {
  CheckSquare,
  CircleDot,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  UserRound,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatDateTime } from '@/lib/utils';
import type { Activity, Task } from '@/types';

type ComposerTab = 'WHATSAPP' | 'CALL' | 'NOTE' | 'TASK';

const TABS: Array<{ id: ComposerTab; label: string }> = [
  { id: 'WHATSAPP', label: 'WhatsApp' },
  { id: 'CALL', label: 'Ligação' },
  { id: 'NOTE', label: 'Anotação' },
  { id: 'TASK', label: 'Nova tarefa' },
];

const QUICK_PHRASES: Record<Exclude<ComposerTab, 'TASK'>, string[]> = {
  WHATSAPP: ['Mensagem enviada', 'Pediu para retornar à tarde', 'Caixa postal'],
  CALL: ['Caixa postal', 'Pediu para retornar à tarde', 'Sem resposta'],
  NOTE: ['Caixa postal', 'Pediu para retornar à tarde', 'Mensagem enviada'],
};

function activityIcon(type: string) {
  switch (type) {
    case 'WHATSAPP':
      return MessageCircle;
    case 'CALL':
      return Phone;
    case 'EMAIL':
      return Mail;
    case 'NOTE':
      return NotebookPen;
    case 'TASK':
      return CheckSquare;
    case 'STAGE_CHANGED':
      return Workflow;
    case 'OWNER_CHANGED':
      return UserRound;
    default:
      return CircleDot;
  }
}

export function LeadActivityHub({
  activities,
  activitiesLoading,
  tasks,
  tasksLoading,
  activityPending,
  taskPending,
  onLogActivity,
  onCreateTask,
  onCompleteTask,
}: {
  activities: Activity[];
  activitiesLoading?: boolean;
  tasks: Task[];
  tasksLoading?: boolean;
  activityPending?: boolean;
  taskPending?: boolean;
  onLogActivity: (input: { type: string; description: string }) => Promise<unknown> | unknown;
  onCreateTask: (input: { title: string; dueAt?: string }) => Promise<unknown> | unknown;
  onCompleteTask: (task: Task) => Promise<unknown> | unknown;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ComposerTab>('WHATSAPP');
  const [description, setDescription] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');

  const submitActivity = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await onLogActivity({ type: tab === 'CALL' ? 'CALL' : tab, description: trimmed });
    setDescription('');
  };

  return (
    <Card>
      <CardHeader title={t('clientFile.history')} description={t('clientFile.historyHelp')} />
      <CardContent className="space-y-5">
        <div>
          <div className="flex flex-wrap gap-1 rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'rounded-[10px] px-3 py-1.5 text-sm font-semibold',
                  tab === item.id
                    ? 'bg-[color:var(--surface-card)] text-[color:var(--ink)] shadow-sm'
                    : 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]',
                )}
              >
                {t(`clientFile.activityTabs.${item.id}`)}
              </button>
            ))}
          </div>

          {tab === 'TASK' ? (
            <form
              className="mt-3 space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const title = taskTitle.trim();
                if (!title) return;
                await onCreateTask({ title, dueAt: taskDue || undefined });
                setTaskTitle('');
                setTaskDue('');
              }}
            >
              <Input
                label={t('clientFile.taskTitle')}
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder={t('clientFile.taskExample')}
              />
              <Input
                label={t('clientFile.taskDue')}
                type="date"
                value={taskDue}
                onChange={(event) => setTaskDue(event.target.value)}
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                loading={taskPending}
                disabled={!taskTitle.trim()}
              >
                {t('clientFile.createTask')}
              </Button>
            </form>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PHRASES[tab].map((phrase, index) => (
                  <button
                    key={phrase}
                    type="button"
                    className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs font-medium text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]"
                    onClick={() =>
                      void submitActivity(t(`clientFile.quickPhrases.${tab}.${index}`))
                    }
                    disabled={activityPending}
                  >
                    {t(`clientFile.quickPhrases.${tab}.${index}`)}
                  </button>
                ))}
              </div>
              <Textarea
                label={t('clientFile.activityRecord')}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('clientFile.activityPlaceholder')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={activityPending}
                disabled={!description.trim()}
                onClick={() => void submitActivity(description)}
              >
                {t('clientFile.record')}
              </Button>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[color:var(--ink)]">{t('clientFile.tasks')}</h4>
          {tasksLoading ? (
            <Skeleton className="mt-2 h-16" />
          ) : tasks.length === 0 ? (
            <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{t('clientFile.noTasks')}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {tasks.map((task) => {
                const done = task.status === 'DONE';
                return (
                  <li
                    key={task.id}
                    className="flex items-start gap-3 rounded-control border border-[color:var(--border)] p-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={done}
                      disabled={done || taskPending}
                      aria-label={t('clientFile.completeTask', { title: task.title })}
                      onChange={() => {
                        if (!done) void onCompleteTask(task);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium text-[color:var(--ink)]',
                          done && 'line-through opacity-70',
                        )}
                      >
                        {task.title}
                      </p>
                      <p className="text-xs text-[color:var(--ink-muted)]">
                        {task.assignee?.name ?? t('clientFile.unassigned')} ·{' '}
                        {formatDateTime(task.dueAt)}
                      </p>
                    </div>
                    <Badge tone={done ? 'green' : task.priority === 'HIGH' ? 'red' : 'slate'}>
                      {t(`clientFile.taskStatuses.${task.status}`)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[color:var(--ink)]">
            {t('clientFile.timeline')}
          </h4>
          {activitiesLoading ? (
            <Skeleton className="mt-2 h-24" />
          ) : activities.length === 0 ? (
            <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
              {t('clientFile.noActivity')}
            </p>
          ) : (
            <ol className="relative mt-3 space-y-4 border-l border-[color:var(--border)] pl-5">
              {activities.map((activity) => {
                const Icon = activityIcon(activity.type);
                return (
                  <li key={activity.id} className="relative">
                    <span className="absolute -left-[29px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-card)] text-[color:var(--ink-muted)]">
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <p className="text-sm font-medium text-[color:var(--ink)]">
                      {t(`clientFile.activityTypes.${activity.type}`, {
                        defaultValue: t('clientFile.activity'),
                      })}
                    </p>
                    {activity.description ? (
                      <p className="text-sm text-[color:var(--ink)]">{activity.description}</p>
                    ) : null}
                    <p className="text-xs text-[color:var(--ink-muted)]">
                      {activity.user.name} · {formatDateTime(activity.createdAt)}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
