import Link from 'next/link';
import { V2Brand } from '@/components/landing-v2-brand';
import { canonicalFaqPath } from '@/lib/faq-routes';
import { TEAM_EMAIL } from '@/lib/i18n';

export function V2Footer({ page = 'home' }: { page?: 'home' | 'how' | 'section' }) {
  return (
    <footer className="landing-v2-footer" data-page={page}>
      <div className="landing-v2-shell landing-v2-footer-grid">
        <div>
          <V2Brand />
          <p>Empresas certas. Próximos passos claros.</p>
        </div>
        <div>
          <strong>Produto</strong>
          <Link href="/como-funciona">Como funciona</Link>
          <Link href="/beneficios">Benefícios</Link>
          <Link href={canonicalFaqPath('pt')}>Perguntas frequentes</Link>
        </div>
        <div>
          <strong>Legal</strong>
          <Link href="/terms">Termos de uso</Link>
          <Link href="/privacy">Política de privacidade</Link>
          <a href={`mailto:${TEAM_EMAIL}`}>Fale com a gente</a>
        </div>
      </div>
      <div className="landing-v2-shell landing-v2-footer-bottom">
        <span>© {new Date().getFullYear()} Prospectly</span>
        <span>Prospecção B2B com mais clareza.</span>
      </div>
    </footer>
  );
}
