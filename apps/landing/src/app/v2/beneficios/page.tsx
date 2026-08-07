import type { Metadata } from 'next';
import { LandingV2SectionPage } from '@/components/landing-v2';

export const metadata: Metadata = {
  title: 'Benefícios | Prospectly V2',
  description: 'Entenda como o Prospectly ajuda você a prospectar com mais clareza e menos trabalho manual.',
  alternates: { canonical: '/v2/beneficios' },
};

export default function BenefitsPage() {
  return <LandingV2SectionPage locale="pt" section="benefits" />;
}
