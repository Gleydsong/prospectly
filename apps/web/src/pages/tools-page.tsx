import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { canManageOrg } from '@/features/settings/can-manage-org';
import { useAuthStore } from '@/stores/auth.store';

export const QUICK = [
  { to: '/tools/opportunity-finder', titleKey: 'tools.opportunityTitle', descKey: 'tools.opportunityDesc' },
  { to: '/search', titleKey: 'tools.searchTitle', descKey: 'tools.searchDesc' },
  { to: '/imports', titleKey: 'tools.importTitle', descKey: 'tools.importDesc' },
  { to: '/agents', titleKey: 'tools.agentsTitle', descKey: 'tools.agentsDesc' },
] as const;

export const ALL = [
  { to: '/agents/whatsapp', titleKey: 'tools.whatsappTitle', descKey: 'tools.whatsappDesc' },
  { to: '/campaigns', titleKey: 'tools.campaignsTitle', descKey: 'tools.campaignsDesc' },
  { to: '/reports', titleKey: 'tools.reportsTitle', descKey: 'tools.reportsDesc' },
  { to: '/pipeline', titleKey: 'tools.pipelineTitle', descKey: 'tools.pipelineDesc' },
  { to: '/tasks', titleKey: 'tools.tasksTitle', descKey: 'tools.tasksDesc' },
] as const;

export const ORG_SCHEMA = [
  { to: '/custom-fields', titleKey: 'tools.customFieldsTitle', descKey: 'tools.customFieldsDesc' },
] as const;

function ToolCard({
  to,
  title,
  description,
  openLabel,
}: {
  to: string;
  title: string;
  description: string;
  openLabel: string;
}) {
  return (
    <Link
      to={to}
      className="group block h-full rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
    >
      <Card interactive className="h-full">
        <CardContent className="flex h-full flex-col p-5">
          <h3 className="text-base font-bold tracking-tight text-[color:var(--ink)]">{title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[color:var(--ink-muted)]">
            {description}
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--accent)] transition-colors group-hover:text-sky-700">
            {openLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ToolsPage() {
  const { t } = useTranslation();
  const role = useAuthStore((state) => state.user?.role);
  const catalog = canManageOrg(role) ? [...ALL, ...ORG_SCHEMA] : [...ALL];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('tools.eyebrow')}
        title={t('tools.title')}
        description={t('tools.subtitle')}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[color:var(--ink)]">{t('tools.quickAccess')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK.map((tool) => (
            <ToolCard
              key={`quick-${tool.to}`}
              to={tool.to}
              title={t(tool.titleKey)}
              description={t(tool.descKey)}
              openLabel={t('tools.open')}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[color:var(--ink)]">{t('tools.available')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.map((tool) => (
            <ToolCard
              key={`${tool.to}-${tool.titleKey}`}
              to={tool.to}
              title={t(tool.titleKey)}
              description={t(tool.descKey)}
              openLabel={t('tools.open')}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
