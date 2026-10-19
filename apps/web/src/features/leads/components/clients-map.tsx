import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LeadScore } from '@/components/ui/lead-score';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { useTheme } from '@/features/theme/theme-provider';
import { sanitizeExternalUrl } from '@/lib/safe-url';
import { fetchClientMap, fetchLead, type ClientMapFilters } from '../api';
import { toWhatsAppDigits } from './lead-contact-channels';
import ClientMapCanvas, { WORLD_BBOX } from './client-map-canvas';

export default function ClientsMap({ filters }: { filters: ClientMapFilters }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [bbox, setBbox] = useState(WORLD_BBOX);
  const [selectedId, setSelectedId] = useState('');
  const [mapError, setMapError] = useState(false);
  const query = useQuery({
    queryKey: ['leads', 'map', filters, bbox],
    queryFn: ({ signal }) => fetchClientMap({ ...filters, bbox }, signal),
  });
  const detail = useQuery({
    queryKey: ['leads', selectedId],
    queryFn: () => fetchLead(selectedId),
    enabled: Boolean(selectedId),
  });
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setSelectedId('');
  }, [filterKey]);
  const client = detail.data;
  const website = client?.website ? sanitizeExternalUrl(client.website) : null;
  const whatsapp =
    client && !client.doNotContact ? toWhatsAppDigits(client.whatsapp || client.phone || '') : null;
  const areaCity = client?.city || filters.city;
  const area = new URLSearchParams({ aba: 'categoria' });
  if (areaCity) area.set('city', areaCity);
  if (client?.state) area.set('state', client.state);
  if (client?.country) area.set('country', client.country);

  return (
    <section className="space-y-4" aria-label={t('clientsMap.title')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--ink-secondary)]" aria-live="polite">
          {query.data
            ? t('clientsMap.count', { count: query.data.meta.total })
            : t('common.loading')}
        </p>
        {areaCity ? (
          <Link
            to={`/prospectar?${area}`}
            className="rounded-control border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--ink)]"
          >
            {t('clientsMap.prospectArea')}
          </Link>
        ) : (
          <span title={t('clientsMap.selectAreaHint')}>
            <Button variant="secondary" disabled>
              {t('clientsMap.prospectArea')}
            </Button>
            <span className="ml-2 text-sm text-[color:var(--ink-secondary)]">
              {t('clientsMap.selectAreaHint')}
            </span>
          </span>
        )}
      </div>
      {query.isError ? (
        <Alert>
          {t('common.errorGeneric')}{' '}
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </Alert>
      ) : null}
      {mapError ? <Alert>{t('clientsMap.mapError')}</Alert> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="relative min-w-0">
          <ClientMapCanvas
            data={query.data}
            dark={theme === 'dark'}
            label={t('clientsMap.title')}
            onViewport={setBbox}
            onSelect={setSelectedId}
            onError={() => setMapError(true)}
            onReady={() => setMapError(false)}
          />
          {query.data?.meta.total === 0 ? (
            <div className="absolute left-1/2 top-1/2 w-[min(90%,360px)] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-6 shadow-panel">
              <h2 className="text-xl font-semibold text-[color:var(--ink)]">
                {t('clientsMap.empty')}
              </h2>
              <p className="my-4 text-sm text-[color:var(--ink-secondary)]">
                {t('clientsMap.emptyHint')}
              </p>
              <Link
                to={`/prospectar?${area}`}
                className="inline-flex rounded-control bg-[color:var(--brand)] px-4 py-3 text-sm text-white"
              >
                {t('clientsMap.prospect')}
              </Link>
            </div>
          ) : null}
          <p className="mt-2 text-sm text-[color:var(--ink-secondary)]">
            {t(query.data?.meta.grouped ? 'clientsMap.zoomHint' : 'clientsMap.selectHint')}
          </p>
          {/* Keyboard alternative to the canvas, also usable when WebGL/tiles fail. */}
          {query.data?.pins.length ? (
            <label className="mt-3 block text-sm text-[color:var(--ink)]">
              {t('clientsMap.select')}
              <select
                className="mt-1 w-full rounded-control border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                <option value="">{t('clientsMap.selectHint')}</option>
                {query.data.pins.map((pin) => (
                  <option key={pin.id} value={pin.id}>
                    {pin.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <aside
          className="rounded-panel border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-5 shadow-panel"
          aria-label={t('clientsMap.selected')}
          aria-live="polite"
        >
          <p className="mb-4 font-mono text-xs uppercase text-[color:var(--ink-secondary)]">
            {t('clientsMap.selected')}
          </p>
          {!selectedId ? (
            <p className="text-sm text-[color:var(--ink-secondary)]">
              {t('clientsMap.selectHint')}
            </p>
          ) : detail.isError ? (
            <Alert>{t('common.errorGeneric')}</Alert>
          ) : !client ? (
            <p>{t('common.loading')}</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
                  {client.companyName}
                </h2>
                <p className="mt-2 text-sm text-[color:var(--ink-secondary)]">
                  {[client.category, client.city, client.state].filter(Boolean).join(' · ')}
                </p>
              </div>
              <LeadStatusBadge status={client.status} />
              <div>
                <p className="mb-3 text-sm text-[color:var(--ink-secondary)]">
                  {t('clientsMap.score')}
                </p>
                <LeadScore score={client.score} />
              </div>
              <div>
                <p className="text-sm text-[color:var(--ink-secondary)]">
                  {t('clientsMap.source')}
                </p>
                <p className="mt-1 text-sm text-[color:var(--ink)]">
                  {t(`reports.sources.${client.source}`)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[color:var(--ink-secondary)]">
                  {t('clientsMap.website')}
                </p>
                {website ? (
                  <a
                    className="mt-1 block break-all text-sm text-[color:var(--brand-hover)] underline"
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {client.website}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-[color:var(--ink)]">
                    {t('clientsMap.noWebsite')}
                  </p>
                )}
              </div>
              {whatsapp ? (
                <a
                  className="block rounded-control bg-[color:var(--brand)] px-4 py-3 text-center text-sm font-medium text-white"
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('clientsMap.whatsapp')}
                </a>
              ) : (
                <p className="text-sm text-[color:var(--ink-secondary)]">
                  {t(client.doNotContact ? 'clientsMap.doNotContact' : 'clientsMap.noWhatsapp')}
                </p>
              )}
              <Link
                className="block rounded-control border border-[color:var(--border)] px-4 py-3 text-center text-sm text-[color:var(--ink)]"
                to={`/clientes/${client.id}`}
              >
                {t('clientsMap.open')}
              </Link>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
