'use client';

import { Briefcase, Buildings, ChartLineUp, Code } from '@phosphor-icons/react';
import { Reveal } from '@/components/motion';
import { BentoCard, BentoIconDisk } from '@/components/ui/bento-card';
import { t, type Locale } from '@/lib/i18n';

const SEGMENTS = [
  { title: 'audienceAgencyTitle', body: 'audienceAgencyBody', Icon: ChartLineUp, span: 'lg:col-span-7' },
  { title: 'audienceConsultingTitle', body: 'audienceConsultingBody', Icon: Briefcase, span: 'lg:col-span-5' },
  { title: 'audienceSoftwareTitle', body: 'audienceSoftwareBody', Icon: Code, span: 'lg:col-span-5' },
  { title: 'audienceSalesTitle', body: 'audienceSalesBody', Icon: Buildings, span: 'lg:col-span-7' },
] as const;

export function AudienceSegments({ locale }: { locale: Locale }) {
  return (
    <section className="bg-[color:var(--bg)]" aria-labelledby="audience-heading">
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
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

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {SEGMENTS.map(({ title, body, Icon, span }, index) => (
            <Reveal key={title} delay={index * 0.04} className={span}>
              <li className="h-full list-none">
                <BentoCard
                  visualSize="compact"
                  visual={
                    <BentoIconDisk>
                      <Icon weight="duotone" className="h-7 w-7" aria-hidden />
                    </BentoIconDisk>
                  }
                  title={t(locale, title)}
                  description={t(locale, body)}
                />
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
