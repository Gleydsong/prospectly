import type { Metadata } from 'next';
import { EnterExplainerPage } from '@/components/enter-explainer-page';
import { landingAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Entrar — o app ainda está abrindo',
  description:
    'O Prospectly ainda não está aberto ao público. Veja como funciona a prospecção local sem site e entre na lista de espera.',
  alternates: landingAlternates('/entrar'),
};

export default function EnterPage() {
  return <EnterExplainerPage locale="pt" />;
}
