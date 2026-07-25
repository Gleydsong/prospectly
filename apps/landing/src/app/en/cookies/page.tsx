import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Cookies used by the Prospectly marketing site.',
};

export default function EnCookiesPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-6 py-16">
      <h1>Cookie Policy</h1>
      <p>Last updated: 25 July 2026</p>
      <p>
        We use essential cookies / localStorage for currency preference and the consent banner.
        Third-party analytics is <strong>off by default</strong>. Portuguese version: /cookies.
      </p>
    </article>
  );
}
