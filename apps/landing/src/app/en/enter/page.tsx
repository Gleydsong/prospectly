import type { Metadata } from 'next';
import { EnterExplainerPage } from '@/components/enter-explainer-page';
import { landingAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Log in — the app is still opening',
  description:
    'Prospectly is not open to the public yet. See how local no-website prospecting works and join the waitlist.',
  alternates: landingAlternates('/en/enter'),
};

export default function EnterPageEn() {
  return <EnterExplainerPage locale="en" />;
}
