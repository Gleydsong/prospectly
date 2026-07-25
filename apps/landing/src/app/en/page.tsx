import Link from 'next/link';
import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { appRegisterUrl } from '@/lib/pricing';

export const metadata: Metadata = {
  title: 'Google Maps and OpenStreetMap lead prospecting',
  description:
    'Tool for digital agencies to prospect local clients. Find businesses without a website and organize your pipeline.',
};

export default function EnHomePage() {
  const locale = 'en' as const;
  return (
    <>
      <section className="hero-panel">
        <div className="mx-auto max-w-5xl px-6 pb-20 pt-10">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
            {t(locale, 'heroEyebrow')}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Prospectly
          </h1>
          <p className="mt-3 max-w-2xl text-xl text-slate-800">{t(locale, 'heroTitle')}</p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
            {t(locale, 'heroSubtitle')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={appRegisterUrl('monthly', 'EUR')}
              className="rounded-md bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
            >
              {t(locale, 'heroPrimary')}
            </a>
            <Link
              href="/en/pricing"
              className="rounded-md border border-slate-300 bg-white/80 px-5 py-3 font-medium text-slate-800 hover:bg-white"
            >
              {t(locale, 'heroSecondary')}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-slate-900">{t(locale, 'problemTitle')}</h2>
        <p className="mt-3 max-w-3xl text-slate-600">{t(locale, 'problemBody')}</p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="text-2xl font-semibold text-slate-900">{t(locale, 'howTitle')}</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n}>
              <h3 className="text-lg font-medium text-slate-900">{t(locale, `how${n}Title`)}</h3>
              <p className="mt-2 text-sm text-slate-600">{t(locale, `how${n}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-slate-900">{t(locale, 'seoTitle')}</h2>
        <p className="mt-3 max-w-3xl text-slate-600">{t(locale, 'seoBody')}</p>
      </section>
    </>
  );
}
