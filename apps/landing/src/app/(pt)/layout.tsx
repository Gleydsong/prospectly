import type { Metadata } from 'next';
import { LandingHtmlDocument, landingDocumentMetadata } from '@/app/landing-html-document';
import { PtSiteChrome } from '@/components/pt-site-chrome';
import { landingOpenGraph } from '@/lib/landing-og';

const sharedMetadata = landingDocumentMetadata();

export const metadata: Metadata = {
  ...sharedMetadata,
  title: {
    default: 'Prospectly | Encontre empresas para prospectar no Brasil',
    template: '%s | Prospectly',
  },
  description:
    'Crie listas segmentadas de empresas brasileiras para sua prospecção B2B. Encontre oportunidades com mais clareza e menos trabalho manual.',
  openGraph: landingOpenGraph({
    ...sharedMetadata.openGraph,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Prospectly',
  }),
};

export default function PtLayout({ children }: { children: React.ReactNode }) {
  return (
    <LandingHtmlDocument lang="pt-BR">
      <PtSiteChrome locale="pt">{children}</PtSiteChrome>
    </LandingHtmlDocument>
  );
}
