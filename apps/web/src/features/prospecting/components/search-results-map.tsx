import { lazy, Suspense, useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/features/theme/theme-provider';
import type { ClientMapResult } from '@/features/leads/api';
import { LeadStatus, type ProspectingSearchResult } from '@/types';

const MapCanvas = lazy(() => import('@/features/leads/components/client-map-canvas'));

/** Search coordinates only: no geocoding and no portfolio endpoint requests. */
export function searchResultsMapData(results: ProspectingSearchResult[]): ClientMapResult {
  const pins = results.flatMap((result) => {
    if (result.importedLeadId) return [];
    const business = result.normalizedData ?? result.data;
    const { latitude, longitude } = business;
    if (
      typeof latitude !== 'number' ||
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > 90 ||
      typeof longitude !== 'number' ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180
    )
      return [];
    return [
      { id: result.id, name: business.companyName, latitude, longitude, status: LeadStatus.NEW },
    ];
  });
  return {
    pins,
    clusters: [],
    meta: { total: pins.length, limit: results.length, grouped: false },
  };
}

export function SearchResultsMap({
  results,
  onSelect,
}: {
  results: ProspectingSearchResult[];
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const data = useMemo(() => searchResultsMapData(results), [results]);
  return (
    <aside className="min-w-0 space-y-3" aria-label={t('prospectResults.mapTitle')}>
      <h3 className="font-semibold text-[color:var(--ink)]">{t('prospectResults.mapTitle')}</h3>
      <p className="text-sm text-[color:var(--ink-secondary)]">{t('prospectResults.mapHint')}</p>
      {data.pins.length ? (
        <>
          {failed ? (
            <p role="status" className="text-sm text-[color:var(--ink-secondary)]">
              {t('prospectResults.mapError')}
            </p>
          ) : null}
          <Suspense fallback={<p>{t('common.loading')}</p>}>
            <ThemedMapCanvas
              data={data}
              presentation="results"
              label={t('prospectResults.mapTitle')}
              onViewport={() => undefined}
              onSelect={onSelect}
              onError={() => setFailed(true)}
              onReady={() => setFailed(false)}
            />
          </Suspense>
          <label className="block text-sm text-[color:var(--ink)]">
            {t('prospectResults.selectMapResult')}
            <select
              className="mt-1 w-full rounded-control border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-2"
              value=""
              onChange={(event) => onSelect(event.target.value)}
            >
              <option value="">{t('prospectResults.selectMapResult')}</option>
              {data.pins.map((pin) => (
                <option key={pin.id} value={pin.id}>
                  {pin.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p className="text-sm text-[color:var(--ink-secondary)]">
          {t('prospectResults.noCoordinates')}
        </p>
      )}
    </aside>
  );
}

function ThemedMapCanvas(props: Omit<ComponentProps<typeof MapCanvas>, 'dark'>) {
  const { theme } = useTheme();
  return <MapCanvas {...props} dark={theme === 'dark'} />;
}
