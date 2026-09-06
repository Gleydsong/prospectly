import type { Metadata } from 'next';
import { landingAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Cookies used by the Prospectly marketing site.',
  alternates: landingAlternates('/en/cookies'),
};

export default function EnCookiesPage() {
  return (
    <article className="legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Cookie Policy</h1>
      <p className="mt-3 text-sm text-[color:var(--ink-muted)]">Last updated: 25 July 2026</p>
      <div className="mt-8 space-y-4 text-base leading-relaxed text-[color:var(--ink-muted)]">
        <p>
          We use essential cookies / localStorage for locale preference and the consent banner.
          Third-party analytics is{' '}
          <strong className="text-[color:var(--ink)]">off by default</strong>. Portuguese version:
          /cookies.
        </p>
      </div>
    </article>
  );
}
