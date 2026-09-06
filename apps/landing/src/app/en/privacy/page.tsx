import type { Metadata } from 'next';
import { landingAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Prospectly handles personal data under LGPD/GDPR.',
  alternates: landingAlternates('/en/privacy'),
};

export default function EnPrivacyPage() {
  return (
    <article className="legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-[color:var(--ink-muted)]">
        Last updated: 28 August 2026. Version: 2026-08-28
      </p>
      <div className="mt-8 space-y-4 text-base leading-relaxed text-[color:var(--ink-muted)]">
        <p>
          Prospectly processes data to provide local B2B prospecting SaaS for agencies and
          freelancers. Privacy contact: privacy@prospectly.dev. Full Portuguese version at /privacy.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          What we collect
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account: name, email, organization, terms consent.</li>
          <li>Product usage: searches, imported leads, pipeline and tasks.</li>
          <li>
            Payments via Asaas (new PIX and card). Historical AbacatePay or Stripe contracts when
            they exist. We do not store full card numbers.
          </li>
          <li>Public business data from OpenStreetMap / Google Places.</li>
        </ul>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Your rights
        </h2>
        <p>
          Request access, correction, portability or deletion via privacy@prospectly.dev or in the
          app under Settings → Privacy (GET /api/v1/privacy/export and DELETE
          /api/v1/privacy/account).
        </p>
      </div>
    </article>
  );
}
