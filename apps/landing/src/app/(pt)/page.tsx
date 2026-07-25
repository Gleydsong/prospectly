import type { Metadata } from 'next';
import { HomeLanding } from '@/components/home-landing';

export const metadata: Metadata = {
  title: 'Prospecção de leads Google Maps e OpenStreetMap',
  description:
    'Ferramenta para agência digital prospectar clientes locais. Encontre empresas sem site e organize o pipeline.',
  keywords: [
    'prospecção de leads Google Maps',
    'OpenStreetMap leads',
    'encontrar empresas sem site',
    'ferramenta para agência digital',
    'prospecção B2B local',
  ],
};

export default function HomePage() {
  return <HomeLanding locale="pt" />;
}
