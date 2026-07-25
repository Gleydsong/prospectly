import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos de uso do SaaS Prospectly.',
};

export default function TermsPage() {
  return (
    <article className="legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Termos de Uso</h1>
      <p className="mt-3 text-sm text-[color:var(--ink-muted)]">
        Última atualização: 25 de julho de 2026. Versão: 2026-07-25
      </p>
      <div className="mt-8 space-y-4 text-base leading-relaxed text-[color:var(--ink-muted)]">
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          1. Serviço
        </h2>
        <p>
          O Prospectly é uma ferramenta de prospecção e organização de leads B2B locais. Ao criar
          conta, você aceita estes termos e a Política de Privacidade.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          2. Conta e organização
        </h2>
        <p>
          Você é responsável por credenciais e pelo uso dos dados importados/pesquisados na sua
          organização multi-tenant.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          3. Planos e pagamento
        </h2>
        <p>
          O plano Starter pode ser mensal (assinatura) ou vitalício (pagamento único). Cobranças via
          Stripe. Cancelamento da assinatura mensal pelo Customer Portal. Plano vitalício não gera
          renovação automática.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          4. Uso aceitável
        </h2>
        <p>
          É proibido usar o serviço para spam ilegal, engenharia social abusiva ou violar direitos de
          titulares. Dados públicos de mapas não isentam compliance com LGPD/GDPR no seu outreach.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          5. Limitação
        </h2>
        <p>
          O serviço é fornecido &quot;como está&quot;. Não garantimos cobertura completa de mapas nem
          taxa de conversão de leads.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          6. Contato
        </h2>
        <p>support@prospectly.dev</p>
      </div>
    </article>
  );
}
