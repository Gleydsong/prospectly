import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Prospectly handles personal data under LGPD/GDPR.',
};

export default function EnPrivacyPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-6 py-16">
      <h1>Privacy Policy</h1>
      <p>Last updated: 25 July 2026 · Version: 2026-07-25</p>
      <p>
        Prospectly processes data to provide local B2B prospecting SaaS for agencies and
        freelancers. Privacy contact: privacy@prospectly.dev. Full Portuguese version at /privacy.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account: name, email, organization, terms consent.</li>
        <li>Product usage: searches, imported leads, pipeline and tasks.</li>
        <li>Payments via Stripe (we do not store full card numbers).</li>
        <li>Public business data from OpenStreetMap / Google Places.</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        Request access, correction, portability or deletion via privacy@prospectly.dev. A full
        in-app DELETE /me flow is planned for phase 2.
      </p>
    </article>
  );
}
