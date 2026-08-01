import type { Metadata } from 'next';
import { HomeLanding } from '@/components/home-landing';

export const metadata: Metadata = {
  title: {
    absolute: 'Prospectly | Encontre empresas para prospectar no Brasil',
  },
  description:
    'Crie listas segmentadas de empresas brasileiras para sua prospecção B2B. Encontre oportunidades com mais clareza e menos trabalho manual.',
  keywords: [
    'prospecção B2B Brasil',
    'lista de empresas',
    'prospecção para agências',
    'encontrar empresas para prospectar',
    'OpenStreetMap leads',
    'filtro sem website',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Prospectly | Encontre empresas para prospectar no Brasil',
    description:
      'Crie listas segmentadas de empresas brasileiras para sua prospecção B2B. Encontre oportunidades com mais clareza e menos trabalho manual.',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prospectly | Encontre empresas para prospectar no Brasil',
    description:
      'Crie listas segmentadas de empresas brasileiras para sua prospecção B2B.',
  },
};

export default function HomePage() {
  return <HomeLanding locale="pt" />;
}
