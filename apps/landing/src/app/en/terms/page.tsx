import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Prospectly SaaS terms of use (summary).',
};

export default function EnTermsPage() {
  return (
    <article className="legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Use</h1>
      <p className="mt-3 text-sm text-[color:var(--ink-muted)]">
        Last updated: 28 August 2026. Version: 2026-08-28
      </p>
      <div className="mt-8 space-y-4 text-base leading-relaxed text-[color:var(--ink-muted)]">
        <p>
          By creating an account you accept these terms and the Privacy Policy. Full Portuguese
          version at /terms.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">Plans</h2>
        <p>
          We offer credit packs (one-time) and monthly unlimited access. New PIX and card charges
          go through Asaas. Monthly PIX lasts 30 days with no auto-renew. Monthly cards renew until
          canceled in-app under Credits. Historical AbacatePay or Stripe contracts are not migrated
          automatically. Credit packs do not auto-renew.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Acceptable use
        </h2>
        <p>
          No illegal spam or abusive outreach. Public map data does not exempt you from privacy laws
          when contacting identifiable people.
        </p>
        <p>support@prospectlyonboard.com</p>
      </div>
    </article>
  );
}
