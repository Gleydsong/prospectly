import type { Metadata } from 'next';
import { LandingHowItWorksV2 } from '@/components/landing-how-it-works-v2';

export const metadata: Metadata = {
  title: 'Como funciona | Prospectly',
  description:
    'Veja como o Prospectly transforma uma busca de empresas em uma próxima conversa comercial mais clara.',
  alternates: { canonical: '/como-funciona' },
  openGraph: {
    title: 'Como funciona | Prospectly',
    description: 'Da busca à conversa, em três passos claros.',
    locale: 'pt_BR',
  },
};

export default function HowItWorksPage() {
  return <LandingHowItWorksV2 locale="pt" />;
}
