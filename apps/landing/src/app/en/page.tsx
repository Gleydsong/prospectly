import type { Metadata } from 'next';
import { HomeLanding } from '@/components/home-landing';

export const metadata: Metadata = {
  title: {
    absolute: 'Prospectly | Find companies to prospect in Brazil',
  },
  description:
    'Build segmented lists of Brazilian companies for B2B prospecting. More clarity, less manual work.',
  alternates: {
    canonical: '/en',
  },
  openGraph: {
    title: 'Prospectly | Find companies to prospect in Brazil',
    description:
      'Build segmented lists of Brazilian companies for B2B prospecting. More clarity, less manual work.',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prospectly | Find companies to prospect in Brazil',
    description: 'Build segmented lists of Brazilian companies for B2B prospecting.',
  },
};

export default function EnHomePage() {
  return <HomeLanding locale="en" />;
}
