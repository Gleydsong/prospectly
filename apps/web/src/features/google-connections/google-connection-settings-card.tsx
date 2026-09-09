import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  disconnectGoogleConnection,
  fetchMyGoogleConnection,
  startGoogleConnection,
} from '@/features/google-connections/api';
import { getApiErrorMessage } from '@/lib/api';
import { Role } from '@/types';

function canConnectGoogle(role: Role | string | undefined): boolean {
  return role !== undefined && role !== Role.VIEWER && role !== 'VIEWER';
}

export function GoogleConnectionSettingsCard({ role }: { role: Role | string | undefined }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const writable = canConnectGoogle(role);
  const flash = searchParams.get('google');

  const mine = useQuery({
    queryKey: ['google-connections', 'me'],
    queryFn: fetchMyGoogleConnection,
  });

  const start = useMutation({
    mutationFn: startGoogleConnection,
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  const disconnect = useMutation({
    mutationFn: disconnectGoogleConnection,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['google-connections'] });
    },
  });

  const errorMessage =
    start.error || disconnect.error
      ? getApiErrorMessage(start.error ?? disconnect.error) || t('googleConnection.error')
      : null;

  return (
    <Card>
      <CardHeader
        className="px-6 py-5 sm:px-8"
        title={t('googleConnection.title')}
        description={t('googleConnection.description')}
      />
      <CardContent className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8">
        {flash === 'connected' ? <Alert tone="success">{t('googleConnection.connectedFlash')}</Alert> : null}
        {flash === 'denied' || flash === 'error' ? (
          <Alert tone="error">{t('googleConnection.callbackError')}</Alert>
        ) : null}
        {mine.isLoading ? <Skeleton className="h-16" /> : null}
        {mine.data?.connected ? (
          <>
            <p className="text-sm text-[color:var(--ink)]">
              {t('googleConnection.connectedAs', { email: mine.data.googleEmail })}
            </p>
            <p className="text-sm text-[color:var(--ink-muted)]">
              {mine.data.lastSyncAt
                ? t('googleConnection.lastSynced', {
                    when: new Date(mine.data.lastSyncAt).toLocaleString(),
                  })
                : t('googleConnection.neverSynced')}
            </p>
          </>
        ) : (
          <p className="text-sm text-[color:var(--ink-muted)]">{t('googleConnection.disconnected')}</p>
        )}
        {mine.data?.lastError ? (
          <Alert tone="error">
            {t(`googleConnection.syncErrors.${mine.data.lastError}`, {
              defaultValue: t('googleConnection.syncErrorGeneric'),
            })}
          </Alert>
        ) : null}
        {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
        {writable ? (
          <div className="flex justify-end gap-2">
            {mine.data?.connected ? (
              <Button
                type="button"
                variant="outline"
                loading={disconnect.isPending}
                onClick={() => disconnect.mutate()}
              >
                {t('googleConnection.disconnect')}
              </Button>
            ) : (
              <Button type="button" loading={start.isPending} onClick={() => start.mutate()}>
                {t('googleConnection.connect')}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--ink-muted)]">{t('googleConnection.viewerHint')}</p>
        )}
      </CardContent>
    </Card>
  );
}
