import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

const QUICK = [
  { to: '/search', titleKey: 'tools.searchTitle', descKey: 'tools.searchDesc' },
  { to: '/imports', titleKey: 'tools.importTitle', descKey: 'tools.importDesc' },
  { to: '/agents', titleKey: 'tools.agentsTitle', descKey: 'tools.agentsDesc' },
  { to: '/pipeline', titleKey: 'tools.pipelineTitle', descKey: 'tools.pipelineDesc' },
] as const;

const ALL = [
  { to: '/search', titleKey: 'tools.searchTitle', descKey: 'tools.searchDesc' },
  { to: '/imports', titleKey: 'tools.importTitle', descKey: 'tools.importDesc' },
  { to: '/agents', titleKey: 'tools.agentsTitle', descKey: 'tools.agentsDesc' },
  { to: '/agents/whatsapp', titleKey: 'tools.whatsappTitle', descKey: 'tools.whatsappDesc' },
  { to: '/campaigns', titleKey: 'tools.campaignsTitle', descKey: 'tools.campaignsDesc' },
  { to: '/pipeline', titleKey: 'tools.pipelineTitle', descKey: 'tools.pipelineDesc' },
  { to: '/tasks', titleKey: 'tools.tasksTitle', descKey: 'tools.tasksDesc' },
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
    <Card className="flex h-full flex-col transition-colors hover:border-white/20">
      <CardContent className="flex h-full flex-col p-5">
        <h3 className="text-base font-bold tracking-tight text-zinc-50">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{description}</p>
        <Link
          to={to}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-zinc-300 hover:text-zinc-50"
        >
          {openLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}

export function ToolsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('tools.eyebrow')}
        title={t('tools.title')}
        description={t('tools.subtitle')}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-50">{t('tools.quickAccess')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK.map((tool) => (
            <ToolCard
              key={tool.to}
              to={tool.to}
              title={t(tool.titleKey)}
              description={t(tool.descKey)}
              openLabel={t('tools.open')}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-50">{t('tools.available')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ALL.map((tool) => (
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
