'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from '@phosphor-icons/react';

import { CookieBanner } from '@/components/cookie-banner';
import { V2Footer, V2Header } from '@/components/landing-v2';
import { LANDING_ROUTE_STATUS } from '@/lib/landing-route-status';
import type { Locale } from '@/lib/i18n';

type StatusChrome = 'v2' | 'panel';

function StatusShell({
  locale,
  chrome,
  children,
}: {
  locale: Locale;
  chrome: StatusChrome;
  children: ReactNode;
}) {
  const copy = LANDING_ROUTE_STATUS[locale];

  if (chrome === 'panel') {
    return <div className="landing-v2">{children}</div>;
  }

  return (
    <div className="landing-v2">
      <a className="landing-v2-skip-link" href="#conteudo-principal">
        {copy.skip}
      </a>
      <V2Header locale={locale} page="section" />
      <main id="conteudo-principal">{children}</main>
      <V2Footer page="section" />
      <CookieBanner locale={locale} />
    </div>
  );
}

export function LandingNotFoundScreen({ locale, chrome }: { locale: Locale; chrome: StatusChrome }) {
  const copy = LANDING_ROUTE_STATUS[locale].notFound;

  return (
    <StatusShell locale={locale} chrome={chrome}>
      <section className="landing-v2-section landing-v2-white landing-v2-status" data-landing-status="not-found">
        <div className="landing-v2-shell landing-v2-centered-copy">
          <p className="landing-v2-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="landing-v2-section-intro">{copy.body}</p>
          <div className="landing-v2-status-actions">
            <Link href={copy.homeHref} className="landing-v2-green-button">
              {copy.homeLabel} <ArrowRight weight="bold" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </StatusShell>
  );
}

export function LandingRouteErrorScreen({
  locale,
  chrome,
  onRetry,
}: {
  locale: Locale;
  chrome: StatusChrome;
  onRetry: () => void;
}) {
  const copy = LANDING_ROUTE_STATUS[locale].error;

  return (
    <StatusShell locale={locale} chrome={chrome}>
      <section className="landing-v2-section landing-v2-white landing-v2-status" data-landing-status="error">
        <div className="landing-v2-shell landing-v2-centered-copy">
          <p className="landing-v2-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="landing-v2-section-intro">{copy.body}</p>
          <div className="landing-v2-status-actions">
            <button type="button" className="landing-v2-green-button" onClick={onRetry}>
              {copy.retryLabel} <ArrowRight weight="bold" aria-hidden />
            </button>
            <Link href={copy.homeHref} className="landing-v2-outline-button">
              {copy.homeLabel}
            </Link>
          </div>
        </div>
      </section>
    </StatusShell>
  );
}

export function LandingRouteLoading({ locale }: { locale: Locale }) {
  const copy = LANDING_ROUTE_STATUS[locale].loading;

  return (
    <div className="landing-v2" data-landing-status="loading">
      <section className="landing-v2-section landing-v2-white landing-v2-status" role="status" aria-busy="true">
        <div className="landing-v2-shell landing-v2-centered-copy">
          <p className="landing-v2-kicker">PROSPECTLY</p>
          <p className="sr-only">{copy.label}</p>
          <div className="landing-v2-loading-pulse" aria-hidden="true" />
        </div>
      </section>
    </div>
  );
}
