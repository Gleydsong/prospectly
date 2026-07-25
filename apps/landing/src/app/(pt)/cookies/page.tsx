import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: 'Cookies usados pelo site Prospectly.',
};

export default function CookiesPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-6 py-16">
      <h1>Política de Cookies</h1>
      <p>Última atualização: 25 de julho de 2026</p>
      <h2>Cookies essenciais</h2>
      <p>
        Necessários para preferência de moeda (localStorage no browser), consentimento do banner e
        funcionamento do site. Não exigem consentimento adicional além da transparência.
      </p>
      <h2>Analytics</h2>
      <p>
        Analytics de terceiros fica <strong>desligado por padrão</strong>. Se ativarmos no futuro,
        pediremos consentimento explícito no banner.
      </p>
      <h2>Como gerenciar</h2>
      <p>
        Você pode limpar o armazenamento local do navegador a qualquer momento. Detalhes de
        privacidade em /privacy.
      </p>
    </article>
  );
}
