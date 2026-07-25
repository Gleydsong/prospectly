import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Prospectly SaaS terms of use (summary).',
};

export default function EnTermsPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-6 py-16">
      <h1>Terms of Use</h1>
      <p>Last updated: 25 July 2026 · Version: 2026-07-25</p>
      <p>
        By creating an account you accept these terms and the Privacy Policy. Full Portuguese
        version at /terms.
      </p>
      <h2>Plans</h2>
      <p>
        Starter may be monthly (subscription) or lifetime (one-time). Billing via Stripe. Cancel
        monthly plans in the Customer Portal.
      </p>
      <h2>Acceptable use</h2>
      <p>
        No illegal spam or abusive outreach. Public map data does not exempt you from privacy laws
        when contacting identifiable people.
      </p>
      <p>support@prospectly.dev</p>
    </article>
  );
}
