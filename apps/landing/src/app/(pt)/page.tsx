import type { Metadata } from 'next';
import { LandingV2 } from '@/components/landing-v2';
import { landingAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Encontre empresas para prospectar no Brasil',
  description:
    'Uma forma mais simples e confiável de encontrar empresas brasileiras alinhadas ao seu cliente ideal.',
  alternates: landingAlternates('/'),
  openGraph: {
    title: 'Prospectly | Encontre empresas para prospectar no Brasil',
    description:
      'Encontre empresas alinhadas ao seu cliente ideal e organize sua próxima conversa comercial.',
    locale: 'pt_BR',
  },
};

export default function HomePage() {
  return <LandingV2 locale="pt" />;
}
