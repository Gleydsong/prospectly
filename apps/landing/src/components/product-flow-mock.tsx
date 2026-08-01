'use client';

import {
  ArrowRight,
  Buildings,
  CheckCircle,
  FunnelSimple,
  MapPin,
} from '@phosphor-icons/react';
import { t, type Locale } from '@/lib/i18n';

type StepDef = {
  key: string;
  title: string;
  Icon: typeof FunnelSimple;
};

const STEPS: StepDef[] = [
  { key: 'filters', title: 'mockFiltersLabel', Icon: FunnelSimple },
  { key: 'results', title: 'mockResultsLabel', Icon: Buildings },
  { key: 'list', title: 'mockListLabel', Icon: CheckCircle },
];

export function ProductFlowMock({ locale }: { locale: Locale }) {
  const companies = [
    t(locale, 'mockCompany1'),
    t(locale, 'mockCompany2'),
    t(locale, 'mockCompany3'),
  ];

  return (
    <figure
      className="w-full max-w-xl overflow-hidden rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] shadow-soft"
      aria-label={
        locale === 'pt'
          ? 'Demonstração do fluxo: filtros, empresas encontradas e lista qualificada'
          : 'Flow demo: filters, companies found, and qualified list'
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--bg-sunken)] px-4 py-2.5">
        <span className="text-xs font-semibold tracking-tight text-[color:var(--ink)]">
          Prospectly · {locale === 'pt' ? 'Busca local' : 'Local search'}
        </span>
        <ol className="hidden items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-[color:var(--ink-muted)] sm:flex">
          {STEPS.map(({ key, title, Icon }, index) => (
            <li key={key} className="flex items-center gap-2">
              {index > 0 ? <ArrowRight weight="bold" className="h-3 w-3 text-accent" aria-hidden /> : null}
              <span className="flex items-center gap-1">
                <Icon weight="bold" className="h-3 w-3 text-accent" aria-hidden />
                {t(locale, title)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1.05fr_1fr_1fr] sm:gap-0 sm:p-0">
        {/* Filters */}
        <section className="rounded-control border border-[color:var(--border)] bg-[color:var(--bg)] p-4 sm:rounded-none sm:border-0 sm:border-r">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
              <FunnelSimple weight="bold" className="h-3.5 w-3.5" aria-hidden />
              {t(locale, 'mockFiltersLabel')}
            </p>
            <span className="text-[10px] font-semibold text-accent">01</span>
          </div>

          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="rounded-control bg-[color:var(--bg-sunken)] px-3 py-2">
              <dt className="text-xs text-[color:var(--ink-muted)]">{t(locale, 'mockCategoryLabel')}</dt>
              <dd className="mt-0.5 font-medium text-[color:var(--ink)]">{t(locale, 'mockCategoryValue')}</dd>
            </div>
            <div className="rounded-control bg-[color:var(--bg-sunken)] px-3 py-2">
              <dt className="flex items-center gap-1 text-xs text-[color:var(--ink-muted)]">
                <MapPin weight="bold" className="h-3 w-3" aria-hidden />
                {t(locale, 'mockCityLabel')}
              </dt>
              <dd className="mt-0.5 font-medium text-[color:var(--ink)]">{t(locale, 'mockCityValue')}</dd>
            </div>
            <div>
              <span className="inline-flex w-full items-center justify-between rounded-control border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-medium text-accent">
                {t(locale, 'mockFilterChip')}
                <span aria-hidden className="inline-flex h-4 w-7 items-center rounded-full bg-accent/80 px-0.5">
                  <span className="ml-auto h-3 w-3 rounded-full bg-white" />
                </span>
              </span>
            </div>
          </dl>
        </section>

        {/* Results */}
        <section className="rounded-control border border-[color:var(--border)] bg-[color:var(--bg)] p-4 sm:rounded-none sm:border-0 sm:border-r">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
              <Buildings weight="bold" className="h-3.5 w-3.5" aria-hidden />
              {t(locale, 'mockResultsLabel')}
            </p>
            <span className="text-[10px] font-semibold text-accent">02</span>
          </div>

          <ul className="mt-3 space-y-2">
            {companies.map((name, index) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-sunken)] px-3 py-2"
              >
                <span className="truncate text-sm text-[color:var(--ink)]">{name}</span>
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    index === 0 ? 'bg-accent' : 'bg-[color:var(--border)]'
                  }`}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Qualified list */}
        <section className="rounded-control border border-[color:var(--border)] bg-[color:var(--bg)] p-4 sm:rounded-none sm:border-0">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
              <CheckCircle weight="bold" className="h-3.5 w-3.5" aria-hidden />
              {t(locale, 'mockListLabel')}
            </p>
            <span className="text-[10px] font-semibold text-accent">03</span>
          </div>
          <p className="mt-1 text-xs text-[color:var(--ink-muted)]">{t(locale, 'mockListHint')}</p>

          <ul className="mt-3 space-y-2">
            {companies.slice(0, 2).map((name) => (
              <li
                key={`list-${name}`}
                className="flex items-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2"
              >
                <CheckCircle weight="fill" className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span className="truncate text-sm font-medium text-[color:var(--ink)]">{name}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </figure>
  );
}
