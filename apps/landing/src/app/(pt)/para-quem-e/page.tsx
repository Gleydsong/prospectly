import type { Metadata } from 'next';
import { LandingV2SectionPage } from '@/components/landing-v2';
import { landingAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Para quem é',
  description:
    'Veja quem usa o Prospectly para encontrar empresas e organizar a próxima conversa comercial.',
  alternates: landingAlternates('/para-quem-e'),
};

export default function AudiencePage() {
  return <LandingV2SectionPage locale="pt" section="audience" />;
}
