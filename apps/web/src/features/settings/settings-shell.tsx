import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { settingsTabPath, type SettingsTab } from './settings-tabs';

export interface SettingsNavItem {
  id: SettingsTab | 'customFields';
  labelKey: string;
  defaultLabel: string;
  to: string;
  adminOnly?: boolean;
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'account',
    labelKey: 'settings.navProfile',
    defaultLabel: 'Perfil',
    to: settingsTabPath('account'),
  },
  {
    id: 'organization',
    labelKey: 'settings.navOrganization',
    defaultLabel: 'Organização',
    to: settingsTabPath('organization'),
  },
  {
    id: 'team',
    labelKey: 'settings.navTeam',
    defaultLabel: 'Usuários e permissões',
    to: settingsTabPath('team'),
  },
  {
    id: 'scoring',
    labelKey: 'settings.navScoring',
    defaultLabel: 'Pontuação',
    to: settingsTabPath('scoring'),
  },
  {
    id: 'preferences',
    labelKey: 'settings.navPreferences',
    defaultLabel: 'Preferências',
    to: settingsTabPath('preferences'),
  },
  {
    id: 'integrations',
    labelKey: 'settings.navIntegrations',
    defaultLabel: 'Integrações',
    to: settingsTabPath('integrations'),
    adminOnly: true,
  },
  {
    id: 'privacy',
    labelKey: 'settings.navPrivacy',
    defaultLabel: 'Privacidade',
    to: '/settings/privacy',
  },
  {
    id: 'customFields',
    labelKey: 'settings.navCustomFields',
    defaultLabel: 'Campos personalizados',
    to: '/custom-fields',
  },
];

export function SettingsShell({
  active,
  showIntegrations = false,
  breadcrumb,
  headerTitle,
  headerDescription,
  children,
}: {
  active: SettingsTab | 'customFields';
  showIntegrations?: boolean;
  breadcrumb?: string;
  headerTitle?: string;
  headerDescription?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const items = SETTINGS_NAV_ITEMS.filter((item) => !item.adminOnly || showIntegrations);

  const title = headerTitle ?? t('settings.title', { defaultValue: 'Configurações' });
  const description =
    headerDescription ??
    t('settings.headerSubtitle', {
      defaultValue: 'Perfil, organização, equipe e preferências.',
    });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={breadcrumb}
        title={title}
        description={description}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <nav
          aria-label={t('settings.navLabel', { defaultValue: 'Configurações' })}
          className="flex gap-1 overflow-x-auto rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-2 shadow-soft lg:sticky lg:top-24 lg:flex-col lg:overflow-visible"
        >
          {items.map((item) => {
            const isActive = item.id === active;
            const label = t(item.labelKey, { defaultValue: item.defaultLabel });
            return (
              <Link
                key={item.id}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 shrink-0 items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]',
                  isActive
                    ? 'bg-[color:var(--ink)] text-white shadow-soft'
                    : 'text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
