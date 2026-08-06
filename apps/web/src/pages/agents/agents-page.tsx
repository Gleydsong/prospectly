import { Bot, MessageCircle, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentsCatalog } from '@/features/agents/hooks';
import { getApiErrorMessage } from '@/lib/api';

const ICONS = {
  'crm-next-action': Workflow,
  'whatsapp-first-message': MessageCircle,
} as const;

export function AgentsPage() {
  const { t } = useTranslation();
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
        <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
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
                  action={<Icon className="h-5 w-5 text-brand-300" aria-hidden />}
                />
                <CardContent className="space-y-4">
                  <p className="text-sm text-zinc-400">
                    {t(`agents.catalog.${agent.id}.description`, {
                      defaultValue: agent.description,
                    })}
                  </p>
                  <Link to={agent.path}>
                    <Button size="sm">{t('agents.open')}</Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
