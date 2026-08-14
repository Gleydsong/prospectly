import { Plug, Shield, User, Users, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

import { settingsTabPath, type SettingsTab } from './settings-tabs';

const ACCOUNT_NAV = {
  id: 'account' as const,
  icon: User,
  labelKey: 'settings.navAccount',
  descKey: 'settings.navAccountDesc',
  to: settingsTabPath('account'),
};

const NAV: Array<{
  id: SettingsTab;
  icon: LucideIcon;
  labelKey: string;
  descKey: string;
  to: string;
  adminOnly?: boolean;
}> = [
  ACCOUNT_NAV,
  {
    id: 'team',
    icon: Users,
    labelKey: 'settings.navTeam',
    descKey: 'settings.navTeamDesc',
    to: settingsTabPath('team'),
  },
  {
    id: 'integrations',
    icon: Plug,
    labelKey: 'settings.navIntegrations',
    descKey: 'settings.navIntegrationsDesc',
    to: settingsTabPath('integrations'),
    adminOnly: true,
  },
  {
    id: 'privacy',
    icon: Shield,
    labelKey: 'settings.navPrivacy',
    descKey: 'settings.navPrivacyDesc',
    to: '/settings/privacy',
  },
];

export function SettingsShell({
  active,
  showIntegrations = false,
  children,
}: {
  active: SettingsTab;
  showIntegrations?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const items = NAV.filter((item) => !item.adminOnly || showIntegrations);
  const current = NAV.find((item) => item.id === active) ?? ACCOUNT_NAV;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('settings.title')}
        title={t(current.labelKey)}
        description={t(current.descKey)}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
        <nav
          aria-label={t('settings.navLabel')}
          className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <Link
                key={item.id}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium tracking-tight transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]',
                  isActive
                    ? 'bg-[color:var(--ink)] text-[color:var(--bg)]'
                    : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
