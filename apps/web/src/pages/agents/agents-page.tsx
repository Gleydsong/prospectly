import { Bot, MessageCircle, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentsCatalog } from '@/features/agents/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { resolveInternalRedirect } from '@/lib/safe-url';

const ICONS = {
  'crm-next-action': Workflow,
  'whatsapp-first-message': MessageCircle,
} as const;

export function AgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const catalog = useAgentsCatalog();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('agents.title')}
        description={t('agents.subtitle')}
      />

      {catalog.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : catalog.isError ? (
        <p className="rounded-control bg-[color:var(--status-danger-bg)] p-3 text-sm text-[color:var(--status-danger-ink)]" role="alert">
          {getApiErrorMessage(catalog.error) ?? t('agents.loadError')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(catalog.data?.data ?? []).map((agent) => {
            const Icon = ICONS[agent.id] ?? Bot;
            return (
              <Card key={agent.id}>
                <CardHeader
                  title={t(`agents.catalog.${agent.id}.name`, { defaultValue: agent.name })}
                  action={
                    <span className="flex h-9 w-9 items-center justify-center rounded-control bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  }
                />
                <CardContent className="space-y-6">
                  <p className="text-sm text-[color:var(--ink-secondary)]">
                    {t(`agents.catalog.${agent.id}.description`, {
                      defaultValue: agent.description,
                    })}
                  </p>
                  <Button
                    size="sm"
                    className="min-w-[6.5rem] px-5"
                    onClick={() => {
                      const path = resolveInternalRedirect(agent.path, '/agents');
                      navigate(path);
                    }}
                  >
                    {t('agents.open')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
