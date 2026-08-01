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
  label: { pt: string; en: string };
  Icon: typeof FunnelSimple;
};

const STEPS: StepDef[] = [
  { key: 'filters', label: { pt: 'Defina', en: 'Define' }, Icon: FunnelSimple },
  { key: 'results', label: { pt: 'Encontre', en: 'Find' }, Icon: Buildings },
  { key: 'list', label: { pt: 'Organize', en: 'Organize' }, Icon: CheckCircle },
];

export function ProductFlowMock({ locale }: { locale: Locale }) {
  const companies = [
    t(locale, 'mockCompany1'),
    t(locale, 'mockCompany2'),
    t(locale, 'mockCompany3'),
  ];
  const copy = locale === 'pt'
    ? {
        appLabel: 'Busca local',
        flowLabel: 'Do ICP à lista',
        define: 'Defina o ICP',
        find: 'Encontre oportunidades',
        organize: 'Adicione à sua lista',
      }
    : {
        appLabel: 'Local search',
        flowLabel: 'From ICP to list',
        define: 'Define your ICP',
        find: 'Find opportunities',
        organize: 'Add to your list',
      };

  return (
    <figure
      className="w-full max-w-xl overflow-hidden rounded-control border border-white/15 bg-[#0a1120]/95 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.9)] backdrop-blur"
      aria-label={
        locale === 'pt'
          ? 'Demonstração do fluxo: filtros, empresas encontradas e lista qualificada'
          : 'Flow demo: filters, companies found, and qualified list'
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-3.5 py-2.5">
        <span className="text-xs font-semibold tracking-tight text-white">
          Prospectly <span className="text-white/45">·</span> {copy.appLabel}
        </span>
        <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-200">
          {copy.flowLabel}
        </span>
      </div>

      <ol className="grid grid-cols-3 border-b border-white/10 bg-[#0d1627]/80 px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-white/55">
          {STEPS.map(({ key, label, Icon }, index) => (
            <li key={key} className="flex min-w-0 items-center justify-center gap-1.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-blue-300/25 bg-blue-400/10 text-[8px] text-blue-200">
                {index + 1}
              </span>
              <Icon weight="bold" className="h-3 w-3 shrink-0 text-blue-400" aria-hidden />
              <span className="truncate">{locale === 'pt' ? label.pt : label.en}</span>
            </li>
          ))}
      </ol>

      <div className="grid gap-3 p-3 sm:grid-cols-[0.88fr_1.12fr] sm:gap-0 sm:p-0">
        <section className="rounded-control border border-white/10 bg-white/[0.03] p-3 sm:rounded-none sm:border-0 sm:border-r sm:p-3.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              <FunnelSimple weight="bold" className="h-3.5 w-3.5" aria-hidden />
              {copy.define}
            </p>
            <span className="text-[10px] font-semibold text-blue-400">01</span>
          </div>

          <dl className="mt-3 space-y-2 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/[0.055] px-2.5 py-2">
              <dt className="text-[10px] text-white/45">{t(locale, 'mockCategoryLabel')}</dt>
              <dd className="mt-0.5 text-xs font-medium leading-snug text-white">{t(locale, 'mockCategoryValue')}</dd>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.055] px-2.5 py-2">
              <dt className="flex items-center gap-1 text-[10px] text-white/45">
                <MapPin weight="bold" className="h-3 w-3" aria-hidden />
                {t(locale, 'mockCityLabel')}
              </dt>
              <dd className="mt-0.5 text-xs font-medium text-white">{t(locale, 'mockCityValue')}</dd>
            </div>
            <div className="pt-0.5">
              <span className="inline-flex w-full items-center justify-between rounded-lg border border-blue-300/25 bg-blue-400/10 px-2.5 py-2 text-[10px] font-medium leading-snug text-blue-200">
                {t(locale, 'mockFilterChip')}
                <span aria-hidden className="inline-flex h-4 w-7 shrink-0 items-center rounded-full bg-blue-500 px-0.5">
                  <span className="ml-auto h-3 w-3 rounded-full bg-white shadow-sm" />
                </span>
              </span>
            </div>
          </dl>
        </section>

        <section className="rounded-control border border-white/10 bg-[#0e182a] p-3 sm:rounded-none sm:border-0 sm:p-3.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              <Buildings weight="bold" className="h-3.5 w-3.5" aria-hidden />
              {copy.find}
            </p>
            <span className="text-[10px] font-semibold text-blue-400">02</span>
          </div>

          <ul className="mt-2.5 space-y-1.5">
            {companies.map((name, index) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-2.5 py-1.5"
              >
                <span className="truncate text-xs text-white/90">{name}</span>
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    index === 0 ? 'bg-blue-400' : 'bg-white/20'
                  }`}
                />
              </li>
            ))}
          </ul>

          <div className="my-3 flex items-center gap-2 text-[10px] text-blue-300/80" aria-hidden>
            <span className="h-px flex-1 bg-white/10" />
            <ArrowRight weight="bold" className="h-3.5 w-3.5 rotate-90" />
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              <CheckCircle weight="bold" className="h-3.5 w-3.5" aria-hidden />
              {copy.organize}
            </p>
            <span className="text-[10px] font-semibold text-blue-400">03</span>
          </div>
          <p className="mt-1 text-[10px] text-white/45">{t(locale, 'mockListHint')}</p>

          <ul className="mt-2 space-y-1.5">
            {companies.slice(0, 2).map((name) => (
              <li
                key={`list-${name}`}
                className="flex items-center gap-2 rounded-lg border border-blue-300/15 bg-blue-400/[0.08] px-2.5 py-1.5"
              >
                <CheckCircle weight="fill" className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden />
                <span className="truncate text-xs font-medium text-white">{name}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </figure>
  );
}
