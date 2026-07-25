import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: 'Cookies usados pelo site Prospectly.',
};

export default function CookiesPage() {
  return (
    <article className="legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Política de Cookies</h1>
      <p className="mt-3 text-sm text-[color:var(--ink-muted)]">
        Última atualização: 25 de julho de 2026
      </p>
      <div className="mt-8 space-y-4 text-base leading-relaxed text-[color:var(--ink-muted)]">
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Cookies essenciais
        </h2>
        <p>
          Necessários para preferência de moeda (localStorage no browser), consentimento do banner e
          funcionamento do site. Não exigem consentimento adicional além da transparência.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Analytics
        </h2>
        <p>
          Analytics de terceiros fica <strong className="text-[color:var(--ink)]">desligado por padrão</strong>.
          Se ativarmos no futuro, pediremos consentimento explícito no banner.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Como gerenciar
        </h2>
        <p>
          Você pode limpar o armazenamento local do navegador a qualquer momento. Detalhes de
          privacidade em /privacy.
        </p>
      </div>
    </article>
  );
}
