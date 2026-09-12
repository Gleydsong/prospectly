import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckSquare,
  KanbanSquare,
  ListChecks,
  Megaphone,
  MessageCircle,
  Search,
  Sparkles,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { canManageOrg } from '@/features/settings/can-manage-org';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

export const QUICK = [
  { to: '/tools/opportunity-finder', titleKey: 'tools.opportunityTitle', descKey: 'tools.opportunityDesc', icon: Sparkles },
  { to: '/search', titleKey: 'tools.searchTitle', descKey: 'tools.searchDesc', icon: Search },
  { to: '/imports', titleKey: 'tools.importTitle', descKey: 'tools.importDesc', icon: Workflow },
  { to: '/agents', titleKey: 'tools.agentsTitle', descKey: 'tools.agentsDesc', icon: Bot },
] as const;

export const ALL = [
  { to: '/agents/whatsapp', titleKey: 'tools.whatsappTitle', descKey: 'tools.whatsappDesc', icon: MessageCircle },
  { to: '/campaigns', titleKey: 'tools.campaignsTitle', descKey: 'tools.campaignsDesc', icon: Megaphone },
  { to: '/reports', titleKey: 'tools.reportsTitle', descKey: 'tools.reportsDesc', icon: BarChart3 },
  { to: '/pipeline', titleKey: 'tools.pipelineTitle', descKey: 'tools.pipelineDesc', icon: KanbanSquare },
  { to: '/tasks', titleKey: 'tools.tasksTitle', descKey: 'tools.tasksDesc', icon: CheckSquare },
] as const;

export const ORG_SCHEMA = [
  { to: '/custom-fields', titleKey: 'tools.customFieldsTitle', descKey: 'tools.customFieldsDesc', icon: ListChecks },
] as const;

function ToolCard({
  to,
  title,
  description,
  openLabel,
  icon: Icon,
  featured,
}: {
  to: string;
  title: string;
  description: string;
  openLabel: string;
  icon: LucideIcon;
  featured?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group block h-full rounded-card focus-visible:outline-none"
    >
      <Card interactive className="h-full">
        <CardContent className={cn('flex h-full flex-col', featured ? 'p-4' : 'p-3.5')}>
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-control bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="text-sm font-semibold tracking-tight text-[color:var(--ink)]">{title}</h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[color:var(--ink-secondary)]">
            {description}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand)] group-hover:text-[color:var(--brand-hover)]">
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
        <h2 className="text-sm font-semibold text-[color:var(--ink)]">{t('tools.quickAccess')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK.map((tool) => (
            <ToolCard
              key={`quick-${tool.to}`}
              to={tool.to}
              title={t(tool.titleKey)}
              description={t(tool.descKey)}
              openLabel={t('tools.open')}
              icon={tool.icon}
              featured
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[color:var(--ink)]">{t('tools.available')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.map((tool) => (
            <ToolCard
              key={`${tool.to}-${tool.titleKey}`}
              to={tool.to}
              title={t(tool.titleKey)}
              description={t(tool.descKey)}
              openLabel={t('tools.open')}
              icon={tool.icon}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
