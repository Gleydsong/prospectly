import type { Metadata } from 'next';
import { IntentLanding, type IntentPageContent } from '@/components/intent-landing';
import { landingAlternates } from '@/lib/seo';

const content: IntentPageContent = {
  title: 'Prospecção B2B no Brasil',
  description:
    'Como montar listas de empresas brasileiras para prospecção B2B com busca local, filtros relevantes e pipeline organizado.',
  h1: 'Prospecção B2B: do ICP à lista de empresas',
  lead: 'Prospecção B2B no Brasil ainda depende demais de Maps manual e planilha. A Prospectly ajuda equipes a transformar o perfil de cliente ideal em listas segmentadas para contactar com método.',
  sections: [
    {
      heading: 'O problema operacional',
      body: 'Copiar telefone do mapa, colar na planilha e perder o follow-up é comum em agências, consultorias e times comerciais pequenos. Falta um fluxo único: buscar, filtrar, revisar e organizar a lista no mesmo lugar.',
    },
    {
      heading: 'Como a Prospectly encaixa',
      body: 'Você define categoria e localização, roda a busca no OpenStreetMap (e Google Places quando disponível) e pode priorizar negócios sem website reportado na fonte. Em seguida importa os selecionados para leads e pipeline interno, com tarefas.',
    },
    {
      heading: 'O que não prometemos',
      body: 'A Prospectly não liga, não fecha venda e não dispara campanhas. Também não confirma de forma absoluta que um negócio “não tem site” — o filtro usa o que o mapa reporta. O valor está em achar e organizar a lista alinhada ao ICP.',
    },
    {
      heading: 'Como começar',
      body: 'Entre na lista de espera para criar sua primeira lista quando o acesso abrir. O plano Free prevê 3 buscas para validar o nicho antes de comprar créditos ou assinar o ilimitado.',
    },
  ],
  ctaPrimary: 'Criar minha primeira lista',
  ctaSecondary: 'Falar com a equipe',
};

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  alternates: landingAlternates('/prospeccao-b2b'),
  openGraph: {
    title: `${content.title} | Prospectly`,
    description: content.description,
  },
};

export default function ProspeccaoB2bPage() {
  return <IntentLanding content={content} />;
}
