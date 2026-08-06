import type { Metadata } from 'next';
import { LandingHowItWorksV2 } from '@/components/landing-how-it-works-v2';

export const metadata: Metadata = {
  title: 'Como funciona | Prospectly V2',
  description: 'Veja como o Prospectly transforma uma busca de empresas em uma próxima conversa comercial mais clara.',
  alternates: { canonical: '/v2/como-funciona' },
  openGraph: {
    title: 'Como funciona | Prospectly V2',
    description: 'Da busca à conversa, em três passos claros.',
    locale: 'pt_BR',
  },
};

export default function HowItWorksPage() {
  return <LandingHowItWorksV2 locale="pt" />;
}
