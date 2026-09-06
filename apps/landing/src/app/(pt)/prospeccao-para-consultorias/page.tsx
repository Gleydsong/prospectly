import type { Metadata } from 'next';
import { IntentLanding, type IntentPageContent } from '@/components/intent-landing';
import { landingAlternates } from '@/lib/seo';

const content: IntentPageContent = {
  title: 'Prospecção para consultorias B2B',
  description:
    'Monte listas de empresas por região e nicho alinhadas ao ICP da consultoria, com revisão e pipeline no mesmo fluxo.',
  h1: 'Prospecção para consultorias B2B',
  lead: 'Consultorias B2B precisam de contas certas por região e setor — com follow-up claro, não com planilha solta.',
  sections: [
    {
      heading: 'Caso de uso concreto',
      body: 'Defina o ICP (setor, porte desejado via categoria/local), rode buscas nas cidades-alvo, filtre o que não encaixa, importe para leads e acompanhe estágios e tarefas no pipeline interno.',
    },
    {
      heading: 'Menos fragmentação',
      body: 'Em vez de Maps + planilha + lembretes soltos, a Prospectly concentra busca, lista e organização. Isso não substitui CRM enterprise — é o fluxo de prospecção local do MVP.',
    },
    {
      heading: 'Transparência de dados',
      body: 'Fontes públicas de mapa (OpenStreetMap; Google Places quando configurado). O filtro sem website reflete o que a fonte reporta. Políticas de privacidade e termos estão publicadas no site.',
    },
  ],
  ctaPrimary: 'Criar minha primeira lista',
  ctaSecondary: 'Falar com a equipe',
};

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  alternates: landingAlternates('/prospeccao-para-consultorias'),
  openGraph: {
    title: `${content.title} | Prospectly`,
    description: content.description,
  },
};

export default function ProspeccaoConsultoriasPage() {
  return <IntentLanding content={content} />;
}
