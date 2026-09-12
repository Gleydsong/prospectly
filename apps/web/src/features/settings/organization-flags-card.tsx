import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  fetchOrganizationFlags,
  type OrganizationFlagKey,
  updateOrganizationFlag,
} from '@/features/organization-flags/api';
import { getApiErrorMessage } from '@/lib/api';

const FLAG_COPY: Record<OrganizationFlagKey, { label: string; description: string }> = {
  saved_report: {
    label: 'settings.flagSavedReport',
    description: 'settings.flagSavedReportDesc',
  },
};

export function OrganizationFlagsCard({
  canManage,
  emailVerified,
}: {
  canManage: boolean;
  emailVerified: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const flags = useQuery({
    queryKey: ['organization-flags'],
    queryFn: fetchOrganizationFlags,
  });

  const updateFlag = useMutation({
    mutationFn: ({ key, enabled }: { key: OrganizationFlagKey; enabled: boolean }) =>
      updateOrganizationFlag(key, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization-flags'] });
    },
  });

  const writeBlocked = !canManage || !emailVerified;

  return (
    <Card>
      <CardHeader
        className="px-6 py-5 sm:px-8"
        title={t('settings.flagsTitle')}
        description={t('settings.flagsDesc')}
      />
      <CardContent className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8">
        {flags.isLoading ? <Skeleton className="h-14" /> : null}
        {flags.isError ? <Alert tone="error">{t('settings.flagsError')}</Alert> : null}
        {(flags.data ?? []).map((flag) => (
          <Switch
            key={flag.key}
            id={`org-flag-${flag.key}`}
            label={t(FLAG_COPY[flag.key].label)}
            description={t(FLAG_COPY[flag.key].description)}
            checked={flag.enabled}
            disabled={writeBlocked || updateFlag.isPending}
            onCheckedChange={(enabled) => updateFlag.mutate({ key: flag.key, enabled })}
          />
        ))}
        {!canManage ? (
          <p className="text-xs text-[color:var(--ink-muted)]">{t('settings.flagsReadOnly')}</p>
        ) : null}
        {canManage && !emailVerified ? (
          <Alert tone="warning">{t('settings.emailGateHint')}</Alert>
        ) : null}
        {updateFlag.isError ? (
          <Alert tone="error">
            {getApiErrorMessage(updateFlag.error) || t('settings.flagsError')}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
