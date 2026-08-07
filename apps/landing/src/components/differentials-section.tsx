'use client';

import {
  Buildings,
  CheckSquare,
  FileCsv,
  Funnel,
  Globe,
  Kanban,
  MagnifyingGlass,
  MapPin,
  Path,
  Timer,
} from '@phosphor-icons/react';
import { Reveal } from '@/components/motion';
import { BentoCard, BentoChip } from '@/components/ui/bento-card';
import { t, type Locale } from '@/lib/i18n';

/** Vitrine: consulta local por categoria e cidade. */
function SearchVisual({ locale }: { locale: Locale }) {
  return (
    <div className="w-full max-w-[300px] space-y-2.5">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5">
        <MagnifyingGlass weight="bold" className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
        <span className="truncate text-xs text-white/70">
          {locale === 'pt' ? 'Clínicas odontológicas' : 'Dental clinics'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <BentoChip>
          <MapPin weight="bold" className="h-3.5 w-3.5" aria-hidden />
          Curitiba, PR
        </BentoChip>
        <BentoChip dim>
          <Globe weight="bold" className="h-3.5 w-3.5" aria-hidden />
          {locale === 'pt' ? 'Brasil' : 'Brazil'}
        </BentoChip>
      </div>
    </div>
  );
}

/** Vitrine: as duas fontes de dados e o filtro que define a intenção da lista. */
function SourcesVisual({ locale }: { locale: Locale }) {
  return (
    <div className="w-full max-w-[330px] space-y-3">
      <div className="flex items-center justify-center gap-3">
        {[Buildings, MapPin, Globe].map((Icon, index) => (
          <span
            key={index}
            className={[
              'flex h-14 w-14 items-center justify-center rounded-panel border',
              index === 1
                ? 'border-white/15 bg-white/[0.08] text-white/85'
                : 'border-white/8 bg-white/[0.03] text-white/40',
            ].join(' ')}
          >
            <Icon weight="duotone" className="h-6 w-6" aria-hidden />
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 rounded-control border border-white/10 bg-white/[0.05] px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-xs text-white/70">
          <Funnel weight="bold" className="h-3.5 w-3.5" aria-hidden />
          {locale === 'pt' ? 'Sem website reportado' : 'No reported website'}
        </span>
        <span className="relative h-4 w-7 rounded-full bg-brand-600">
          <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white" />
        </span>
      </div>
    </div>
  );
}

/** Vitrine: o que o time organiza depois que a lista existe. */
function PipelineVisual({ locale }: { locale: Locale }) {
  const chips: Array<{ label: string; icon: typeof Kanban; dim?: boolean }> =
    locale === 'pt'
      ? [
          { label: 'Estágios', icon: Kanban },
          { label: 'Tarefas', icon: CheckSquare },
          { label: 'Follow-up', icon: Timer, dim: true },
          { label: 'Exportar CSV', icon: FileCsv },
          { label: 'Leads', icon: Buildings, dim: true },
        ]
      : [
          { label: 'Stages', icon: Kanban },
          { label: 'Tasks', icon: CheckSquare },
          { label: 'Follow-up', icon: Timer, dim: true },
          { label: 'CSV export', icon: FileCsv },
          { label: 'Leads', icon: Buildings, dim: true },
        ];

  return (
    <div className="flex w-full max-w-[420px] flex-wrap justify-center gap-2">
      {chips.map(({ label, icon: Icon, dim }) => (
        <BentoChip key={label} dim={dim}>
          <Icon weight="bold" className="h-3.5 w-3.5" aria-hidden />
          {label}
        </BentoChip>
      ))}
    </div>
  );
}

/** Vitrine: do mapa à lista, sem copiar e colar. */
function FlowVisual({ locale }: { locale: Locale }) {
  const steps = locale === 'pt' ? ['ICP', 'Busca', 'Lista'] : ['ICP', 'Search', 'List'];

  return (
    <div className="flex w-full max-w-[280px] items-center justify-center gap-2">
      {steps.map((step, index) => (
        <span key={step} className="flex items-center gap-2">
          <span className="rounded-control border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/80">
            {step}
          </span>
          {index < steps.length - 1 ? (
            <Path weight="bold" className="h-3.5 w-3.5 text-white/25" aria-hidden />
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function DifferentialsSection({ locale }: { locale: Locale }) {
  const cards = [
    { key: 'diff1', visual: <SearchVisual locale={locale} />, span: 'lg:col-span-5' },
    { key: 'diff2', visual: <SourcesVisual locale={locale} />, span: 'lg:col-span-7' },
    { key: 'diff3', visual: <PipelineVisual locale={locale} />, span: 'lg:col-span-7' },
    { key: 'diff4', visual: <FlowVisual locale={locale} />, span: 'lg:col-span-5' },
  ] as const;

  return (
    <section className="bg-[color:var(--bg-sunken)]" aria-labelledby="diffs-heading">
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2
            id="diffs-heading"
            className="text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
          >
            {t(locale, 'diffsTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-[55ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
            {t(locale, 'diffsSubtitle')}
          </p>
        </Reveal>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {cards.map(({ key, visual, span }, index) => (
            <Reveal key={key} delay={index * 0.04} className={span}>
              <li className="h-full list-none">
                <BentoCard
                  visual={visual}
                  title={t(locale, `${key}Title` as 'diff1Title')}
                  description={t(locale, `${key}Body` as 'diff1Body')}
                />
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
