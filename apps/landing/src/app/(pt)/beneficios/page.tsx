import type { Metadata } from 'next';
import { LandingV2SectionPage } from '@/components/landing-v2';
import { landingAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Benefícios',
  description:
    'Entenda como o Prospectly ajuda você a prospectar com mais clareza e menos trabalho manual.',
  alternates: landingAlternates('/beneficios'),
};

export default function BenefitsPage() {
  return <LandingV2SectionPage locale="pt" section="benefits" />;
}
