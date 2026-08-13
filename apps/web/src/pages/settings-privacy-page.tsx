import { Ban, Download, Eye, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { canManageOrg } from '@/features/settings/can-manage-org';
import { PrivacyActionsCard } from '@/features/settings/privacy-actions-card';
import { SettingsShell } from '@/features/settings/settings-shell';
import { useAuthStore } from '@/stores/auth.store';

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:3001';

export function SettingsPrivacyPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const privacyUrl = i18n.language.startsWith('en')
    ? `${LANDING_URL}/en/privacy`
    : `${LANDING_URL}/privacy`;

  const rights = [
    { icon: Eye, text: t('settings.privacyPage.rightAccess') },
    { icon: Pencil, text: t('settings.privacyPage.rightCorrection') },
    { icon: Trash2, text: t('settings.privacyPage.rightDeletion') },
    { icon: Download, text: t('settings.privacyPage.rightPortability') },
    { icon: Ban, text: t('settings.privacyPage.rightObjection') },
  ];

  return (
    <SettingsShell active="privacy" showIntegrations={canManageOrg(user?.role)}>
      <Card>
        <CardHeader
          className="px-6 py-5 sm:px-8"
          title={t('settings.privacyPage.rightsTitle')}
          description={t('settings.privacyPage.rightsDesc')}
        />
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <ul className="divide-y divide-[color:var(--border)]">
            {rights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--ink-muted)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-sm leading-6 text-[color:var(--ink)]">{text}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          className="px-6 py-5 sm:px-8"
          title={t('settings.privacyPage.controllerTitle')}
          description={t('settings.privacyPage.controllerDesc')}
        />
        <CardContent className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8">
          <p className="text-sm leading-6 text-[color:var(--ink-muted)]">
            {t('settings.privacyPage.contact')}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.open(privacyUrl, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4" />
            {t('settings.privacyPage.fullPolicy')}
          </Button>
        </CardContent>
      </Card>

      <PrivacyActionsCard />
    </SettingsShell>
  );
}
