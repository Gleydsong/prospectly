import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { RouteFallback } from '@/components/route-fallback';

const Dashboard = lazy(() =>
  import('./dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const Reports = lazy(() => import('./reports-page').then((m) => ({ default: m.ReportsPage })));
const Search = lazy(() => import('./search-page').then((m) => ({ default: m.SearchPage })));
const Finder = lazy(() =>
  import('./opportunity-finder-page').then((m) => ({ default: m.OpportunityFinderPage })),
);
const Imports = lazy(() => import('./imports-page').then((m) => ({ default: m.ImportsPage })));
const Clients = lazy(() => import('./leads/leads-page').then((m) => ({ default: m.LeadsPage })));
const Lists = lazy(() => import('./campaigns-page').then((m) => ({ default: m.CampaignsPage })));
const Pipeline = lazy(() => import('./pipeline-page').then((m) => ({ default: m.PipelinePage })));

function Destination({
  parameter,
  options,
  children,
}: {
  parameter: string;
  options: Array<{ value: string; label: string }>;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const active = options.some((option) => option.value === params.get(parameter))
    ? params.get(parameter)
    : options[0]?.value;
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2" aria-label={t('nav.destinationViews')}>
        {options.map((option) => {
          const next = new URLSearchParams(params);
          next.set(parameter, option.value);
          return (
            <Link
              key={option.value}
              to={`?${next}`}
              aria-current={active === option.value ? 'page' : undefined}
              className={`rounded-control px-4 py-3 text-sm font-medium ${
                active === option.value
                  ? 'bg-[color:var(--brand-soft)] text-[color:var(--brand-hover)]'
                  : 'text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)]'
              }`}
            >
              {t(option.label)}
            </Link>
          );
        })}
      </nav>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </div>
  );
}

export function HomeDestination() {
  const [params] = useSearchParams();
  return (
    <Destination
      parameter="aba"
      options={[
        { value: 'inicio', label: 'nav.principal' },
        { value: 'relatorios', label: 'nav.reports' },
      ]}
    >
      {params.get('aba') === 'relatorios' ? <Reports /> : <Dashboard />}
    </Destination>
  );
}

export function ProspectDestination() {
  const [params] = useSearchParams();
  const tab = params.get('aba');
  return (
    <Destination
      parameter="aba"
      options={[
        { value: 'categoria', label: 'nav.byCategory' },
        { value: 'servico', label: 'nav.byService' },
        { value: 'importar', label: 'nav.imports' },
      ]}
    >
      {tab === 'servico' ? <Finder /> : tab === 'importar' ? <Imports /> : <Search />}
    </Destination>
  );
}

export function ClientsDestination() {
  const [params] = useSearchParams();
  if (params.get('vista') === 'listas') return <ListsDestination />;
  if (params.get('vista') === 'etapas') return <PipelineDestination />;
  return (
    <Suspense fallback={<RouteFallback />}>
      <Clients />
    </Suspense>
  );
}

export function PipelineDestination() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <Link
        to="/clientes?vista=lista"
        className="text-sm font-medium text-[color:var(--brand-hover)]"
      >
        {t('clientsViews.backToClients')}
      </Link>
      <Suspense fallback={<RouteFallback />}>
        <Pipeline />
      </Suspense>
    </div>
  );
}

export function ListsDestination() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <Link
        to="/clientes?vista=lista"
        className="text-sm font-medium text-[color:var(--brand-hover)]"
      >
        {t('clientsViews.backToClients')}
      </Link>
      <Suspense fallback={<RouteFallback />}>
        <Lists />
      </Suspense>
    </div>
  );
}
