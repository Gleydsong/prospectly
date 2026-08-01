import Link from 'next/link';
import { ListPlus, EnvelopeSimple } from '@phosphor-icons/react/dist/ssr';
import { Reveal } from '@/components/motion';
import { TEAM_EMAIL } from '@/lib/i18n';
import { enterExplainerUrl } from '@/lib/pricing';

export type IntentSection = {
  heading: string;
  body: string;
};

export type IntentPageContent = {
  title: string;
  description: string;
  h1: string;
  lead: string;
  sections: IntentSection[];
  ctaPrimary: string;
  ctaSecondary: string;
};

export function IntentLanding({ content }: { content: IntentPageContent }) {
  return (
    <article className="hero-wash">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Reveal>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
            {content.h1}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[color:var(--ink-muted)]">{content.lead}</p>
        </Reveal>

        <div className="mt-12 space-y-10">
          {content.sections.map((section) => (
            <Reveal key={section.heading}>
              <section>
                <h2 className="text-xl font-semibold tracking-tight text-[color:var(--ink)] md:text-2xl">
                  {section.heading}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-[color:var(--ink-muted)]">{section.body}</p>
              </section>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14 flex flex-wrap gap-3">
          <Link
            href={enterExplainerUrl('pt')}
            className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover dark:text-accent-ink"
          >
            <ListPlus weight="bold" className="h-4 w-4" aria-hidden />
            {content.ctaPrimary}
          </Link>
          <a
            href={`mailto:${TEAM_EMAIL}`}
            className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-6 text-sm font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <EnvelopeSimple weight="bold" className="h-4 w-4" aria-hidden />
            {content.ctaSecondary}
          </a>
        </Reveal>
      </div>
    </article>
  );
}
