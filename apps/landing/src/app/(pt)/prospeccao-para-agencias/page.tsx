import type { Metadata } from 'next';
import { IntentLanding, type IntentPageContent } from '@/components/intent-landing';

const content: IntentPageContent = {
  title: 'Prospecção para agências B2B',
  description:
    'Como agências de marketing e performance B2B montam listas de empresas locais para ofertar site, SEO ou mídia — sem inventar resultados.',
  h1: 'Prospecção para agências B2B',
  lead: 'Agências que vendem site, SEO ou performance precisam de listas locais alinhadas ao ICP — não de manhãs intermináveis no Maps.',
  sections: [
    {
      heading: 'Caso de uso concreto',
      body: 'Exemplo: buscar clínicas ou comércios numa cidade, priorizar quem o mapa não associa a website, revisar telefone e endereço, importar para o pipeline e distribuir follow-up na equipe.',
    },
    {
      heading: 'O que a Prospectly entrega',
      body: 'Busca por categoria e local, filtro sem website reportado, importação seletiva e organização em leads/tarefas. Não prometemos taxa de fechamento nem “leads quentes” — o valor está em achar e organizar.',
    },
    {
      heading: 'Para performance e marketing B2B',
      body: 'Listas segmentadas ajudam a planejar outreach e ofertas locais. Integrações nativas com CRMs externos ficam para depois; no MVP o funil fica no Prospectly.',
    },
  ],
  ctaPrimary: 'Criar minha primeira lista',
  ctaSecondary: 'Falar com a equipe',
};

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  alternates: {
    canonical: '/prospeccao-para-agencias',
  },
  openGraph: {
    title: `${content.title} | Prospectly`,
    description: content.description,
  },
};

export default function ProspeccaoAgenciasPage() {
  return <IntentLanding content={content} />;
}
