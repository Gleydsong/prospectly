import type { Metadata } from 'next';
import { LandingV2SectionPage } from '@/components/landing-v2';

export const metadata: Metadata = {
  title: 'Para quem é | Prospectly V2',
  description: 'Veja quem usa o Prospectly para encontrar empresas e organizar a próxima conversa comercial.',
  alternates: { canonical: '/v2/para-quem-e' },
};

export default function AudiencePage() {
  return <LandingV2SectionPage locale="pt" section="audience" />;
}
