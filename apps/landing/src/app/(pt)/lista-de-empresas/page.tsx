import type { Metadata } from 'next';
import { IntentLanding, type IntentPageContent } from '@/components/intent-landing';
import { landingAlternates } from '@/lib/seo';

const content: IntentPageContent = {
  title: 'Lista de empresas para prospecção',
  description:
    'Crie listas segmentadas de empresas por categoria e cidade para sua prospecção B2B, com revisão e pipeline no mesmo fluxo.',
  h1: 'Lista de empresas: do filtro à prospecção',
  lead: 'Uma lista boa não é volume bruto. É o conjunto de empresas que batem com o ICP, revisadas e prontas para o time comercial acompanhar no funil.',
  sections: [
    {
      heading: 'Montar a lista com intenção',
      body: 'Na Prospectly você busca por categoria e local, aplica filtros relevantes — inclusive sem website reportado — e seleciona o que importa antes de importar. A lista deixa de ser um dump do mapa.',
    },
    {
      heading: 'Organizar depois de achar',
      body: 'Os resultados importados viram leads no pipeline interno, com estágios e tarefas. Assim a lista não fica parada numa planilha sem dono do próximo passo.',
    },
    {
      heading: 'CSV no mesmo fluxo',
      body: 'Além da busca em mapa, o produto permite importar CSV para enriquecer ou trazer bases próprias. Exportação CSV para CRMs externos ainda não faz parte do MVP.',
    },
    {
      heading: 'Validar antes de escalar',
      body: 'Use as 3 buscas do Free no seu nicho. Se a lista fizer sentido, avance para créditos ou o plano ilimitado.',
    },
  ],
  ctaPrimary: 'Criar minha primeira lista',
  ctaSecondary: 'Falar com a equipe',
};

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  alternates: landingAlternates('/lista-de-empresas'),
  openGraph: {
    title: `${content.title} | Prospectly`,
    description: content.description,
  },
};

export default function ListaDeEmpresasPage() {
  return <IntentLanding content={content} />;
}
