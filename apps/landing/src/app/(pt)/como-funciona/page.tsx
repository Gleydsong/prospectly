import type { Metadata } from 'next';
import { LandingHowItWorksV2 } from '@/components/landing-how-it-works-v2';
import { landingAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Como funciona',
  description:
    'Veja como o Prospectly transforma uma busca de empresas em uma próxima conversa comercial mais clara.',
  alternates: landingAlternates('/como-funciona'),
  openGraph: {
    title: 'Como funciona | Prospectly',
    description: 'Da busca à conversa, em três passos claros.',
    locale: 'pt_BR',
  },
};

export default function HowItWorksPage() {
  return <LandingHowItWorksV2 locale="pt" />;
}
