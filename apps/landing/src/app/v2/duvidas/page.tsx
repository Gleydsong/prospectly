import type { Metadata } from 'next';
import { LandingV2SectionPage } from '@/components/landing-v2';

export const metadata: Metadata = {
  title: 'Dúvidas frequentes | Prospectly V2',
  description: 'Respostas diretas sobre busca, dados, créditos e o fluxo do Prospectly.',
  alternates: { canonical: '/v2/duvidas' },
};

export default function QuestionsPage() {
  return <LandingV2SectionPage locale="pt" section="faq" />;
}
