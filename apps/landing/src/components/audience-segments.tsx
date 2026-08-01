'use client';

import { Briefcase, Buildings, ChartLineUp, Code } from '@phosphor-icons/react';
import { Reveal } from '@/components/motion';
import { t, type Locale } from '@/lib/i18n';

const SEGMENTS = [
  { title: 'audienceAgencyTitle', body: 'audienceAgencyBody', Icon: ChartLineUp },
  { title: 'audienceConsultingTitle', body: 'audienceConsultingBody', Icon: Briefcase },
  { title: 'audienceSoftwareTitle', body: 'audienceSoftwareBody', Icon: Code },
  { title: 'audienceSalesTitle', body: 'audienceSalesBody', Icon: Buildings },
] as const;

export function AudienceSegments({ locale }: { locale: Locale }) {
  return (
    <section className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20" aria-labelledby="audience-heading">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2
          id="audience-heading"
          className="text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
        >
          {t(locale, 'audienceTitle')}
        </h2>
        <p className="mx-auto mt-4 max-w-[55ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
          {t(locale, 'audienceSubtitle')}
        </p>
      </Reveal>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {SEGMENTS.map(({ title, body, Icon }, index) => (
          <Reveal key={title} delay={index * 0.04}>
            <li className="surface-raised h-full rounded-control p-6">
              <Icon weight="duotone" className="h-7 w-7 text-accent" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-[color:var(--ink)]">
                {t(locale, title)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)] md:text-base">
                {t(locale, body)}
              </p>
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
