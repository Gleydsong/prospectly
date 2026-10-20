import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { fetchClientMap } from '@/features/leads/api';
import { useTheme } from '@/features/theme/theme-provider';

const ClientMapCanvas = lazy(() => import('@/features/leads/components/client-map-canvas'));

/** Shares the persisted-client endpoint and renderer with Clientes > Mapa. */
export function LeadsMapCard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [bbox, setBbox] = useState('-180,-90,180,90');
  const [mapError, setMapError] = useState(false);
  const query = useQuery({
    queryKey: ['leads', 'map', {}, bbox],
    queryFn: ({ signal }) => fetchClientMap({ bbox }, signal),
  });

  return (
    <Card>
      <CardHeader
        title={t('home.map')}
        description={
          query.data ? t('clientsMap.count', { count: query.data.meta.total }) : undefined
        }
        action={
          <Link
            className="text-sm font-medium text-[color:var(--accent)]"
            to="/clientes?vista=mapa"
          >
            {t('home.viewMap')} →
          </Link>
        }
      />
      <CardContent>
        {query.isPending ? <p role="status">{t('common.loading')}</p> : null}
        {query.isError ? (
          <Alert tone="error">
            {t('dashboard.loadError')}{' '}
            <Button variant="outline" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          </Alert>
        ) : null}
        {mapError ? <Alert tone="error">{t('clientsMap.mapError')}</Alert> : null}
        {!query.isError ? (
          <Suspense fallback={<p role="status">{t('common.loading')}</p>}>
            <ClientMapCanvas
              compact
              data={query.data}
              dark={theme === 'dark'}
              label={t('home.map')}
              onViewport={setBbox}
              onSelect={(id) => navigate(`/clientes/${id}`)}
              onError={() => setMapError(true)}
              onReady={() => setMapError(false)}
            />
          </Suspense>
        ) : null}
        {query.data?.meta.total === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--ink-secondary)]">{t('clientsMap.empty')}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
